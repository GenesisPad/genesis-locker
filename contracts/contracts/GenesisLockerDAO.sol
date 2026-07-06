// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/governance/utils/IVotes.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// ─────────────────────────────────────────────────────────────────────────────
// External interface — the main GenesisLocker contract
// The DAO must be set as owner of GenesisLocker for platform/emergency actions.
// ─────────────────────────────────────────────────────────────────────────────
interface IGenesisLocker {
    function setCreationFee(uint256 feeBps) external;
    function pause() external;
    function unpause() external;
}

/**
 * @title  GenesisLockerDAO
 * @author Genesis Locker
 * @notice Community governance for the Genesis Locker protocol, deployed on Base.
 *
 * Key properties:
 *   • Token-weighted voting via ERC20Votes snapshot (block.number - 1)
 *   • 0.5% supply threshold required to vote or propose (dynamic)
 *   • Four vote types: For / Against / Abstain / Veto
 *   • Abstain excluded from pass/fail ratio — only For/(For+Against) counts
 *   • Typed action fields only — no arbitrary calldata (prevents spoofing)
 *   • Per-type configs: quorum, pass threshold, durations, timelock (all dynamic)
 *   • Treasury mutex: one treasury proposal active at a time
 *   • Ownable2Step: safe transfer to multi-sig then to address(this) for full DAO
 *
 * Ownership progression:
 *   Stage 1 → deployer wallet   (iteration & testing)
 *   Stage 2 → Gnosis Safe 3/5  (distributed trust, no single point of failure)
 *   Stage 3 → address(this)     (fully self-governing; changes need a passed vote)
 */
contract GenesisLockerDAO is Ownable2Step, ReentrancyGuard {

    // ═══════════════════════════════════════════════════════════════════════
    // ENUMS
    // ═══════════════════════════════════════════════════════════════════════

    enum ProposalType {
        PAYMENT,     // compensate a contributor in LOCK tokens
        MEMBERSHIP,  // add or remove a core contributor
        PLATFORM,    // change protocol fee or other settings
        TREASURY,    // large fund movements (whitelist-gated)
        EMERGENCY    // guardian-only pause / unpause
    }

    enum VoteType {
        FOR,
        AGAINST,
        ABSTAIN,  // counts toward quorum, excluded from pass ratio
        VETO      // instant-kill if threshold reached
    }

    enum ActionType {
        NONE,               // signal proposal — no on-chain side effects
        TRANSFER,           // send LOCK tokens from DAO treasury to recipient
        ADD_MEMBER,         // whitelist an address for treasury proposals
        REMOVE_MEMBER,      // remove from whitelist
        CHANGE_PLATFORM_FEE,// update GenesisLocker creation fee (bps)
        PAUSE_PROTOCOL,     // emergency pause on GenesisLocker contract
        UNPAUSE_PROTOCOL    // lift emergency pause
    }

    enum ProposalStatus {
        DISCUSSION, // created; voting not yet open
        ACTIVE,     // voting window open
        QUEUED,     // passed; awaiting timelock expiry
        EXECUTED,   // successfully executed
        DEFEATED,   // failed quorum or pass threshold
        VETOED,     // killed by veto votes
        CANCELLED   // cancelled by proposer before any votes
    }

    // ═══════════════════════════════════════════════════════════════════════
    // STRUCTS
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @dev Per-type governance config. All values settable by owner.
     * @param quorum           Minimum (For+Against+Abstain) votes for binding result
     * @param passBps          Min For/(For+Against) in basis points (5100 = 51%)
     * @param votingDuration   Voting window length in seconds
     * @param timelockDelay    Seconds between passing and execution
     * @param discussionPeriod Seconds after creation before voting opens
     * @param requiresWhitelist If true, only whitelisted addresses may propose
     */
    struct TypeConfig {
        uint256 quorum;
        uint256 passBps;
        uint256 votingDuration;
        uint256 timelockDelay;
        uint256 discussionPeriod;
        bool    requiresWhitelist;
    }

    /**
     * @dev Full proposal record stored on-chain.
     *      Action fields are typed — no raw calldata to prevent spoofing.
     */
    struct Proposal {
        // Identity
        uint256      id;
        string       title;
        string       description;
        ProposalType proposalType;
        ProposalStatus status;

        // Proposer
        address proposer;
        uint256 snapshotBlock;   // block.number - 1 at creation
        uint256 createdAt;

        // Timing
        uint256 votingStartsAt;  // createdAt + discussionPeriod
        uint256 votingEndsAt;    // votingStartsAt + votingDuration
        uint256 timelockEndsAt;  // set when proposal passes; 0 until then

        // Typed action (anti-spoofing: no arbitrary calldata)
        ActionType actionType;
        address    actionRecipient;  // TRANSFER, ADD_MEMBER, REMOVE_MEMBER
        uint256    actionAmount;     // TRANSFER: token amount (18 decimals)
        uint256    actionValueBps;   // CHANGE_PLATFORM_FEE: new fee in bps

        // Tally
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 votesAbstain;
        uint256 votesVeto;
        uint256 uniqueVoters;

        // Deposit
        uint256 deposit;
        bool    depositRefunded;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // STATE — all dynamic; changeable by owner; hardcoded values are defaults only
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice LOCK token (must implement ERC20Votes / IVotes + IERC20)
    IVotes  public lockToken;
    IERC20  public lockTokenERC20;

    /// @notice Address that receives burned deposits and is allowed on treasury proposals
    address public treasury;

    /// @notice Guardian can create emergency proposals without token threshold
    address public guardian;

    /// @notice The main GenesisLocker protocol contract (for fee + pause actions)
    address public lockerContract;

    /// @notice Basis points threshold to vote or propose (default 50 = 0.5%)
    uint256 public thresholdBps;

    /// @notice Basis points threshold to cast a veto vote (default 100 = 1.0%)
    uint256 public vetoThresholdBps;

    /// @notice Token deposit required to create a proposal (0 = disabled at launch)
    uint256 public proposalDeposit;

    /// @notice Maximum concurrent active proposals (spam prevention)
    uint256 public maxActiveProposals;

    /// @notice Running proposal counter
    uint256 public proposalCount;

    /// @notice Count of proposals that have not yet reached a terminal status
    uint256 public activeProposalCount;

    /// @notice Mutex: only one TREASURY proposal may be active at a time
    bool public treasuryProposalActive;

    /// @notice Per-type governance configs
    mapping(ProposalType => TypeConfig) public typeConfigs;

    /// @notice All proposals
    mapping(uint256 => Proposal) public proposals;

    /// @notice Whether a wallet has voted on a proposal
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    /// @notice The vote each wallet cast on each proposal
    mapping(uint256 => mapping(address => VoteType)) public voteRecord;

    /// @notice Whitelist for TREASURY proposals (and MEMBERSHIP targets)
    mapping(address => bool) public isWhitelisted;

    // ═══════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════

    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        ProposalType    proposalType,
        ActionType      actionType,
        string          title,
        uint256         votingStartsAt,
        uint256         votingEndsAt
    );
    event VotingOpened(uint256 indexed proposalId);
    event VoteCast(
        uint256 indexed proposalId,
        address indexed voter,
        VoteType        voteType,
        uint256         weight
    );
    event ProposalQueued(uint256 indexed proposalId, uint256 timelockEndsAt);
    event ProposalExecuted(uint256 indexed proposalId);
    event ProposalDefeated(uint256 indexed proposalId);
    event ProposalVetoed(uint256 indexed proposalId);
    event ProposalCancelled(uint256 indexed proposalId);
    event DepositRefunded(uint256 indexed proposalId, address indexed to, uint256 amount);
    event DepositBurned(uint256 indexed proposalId, uint256 amount);

    // Config change events — full audit trail, no silent updates
    event ThresholdBpsUpdated(uint256 oldBps, uint256 newBps);
    event VetoThresholdBpsUpdated(uint256 oldBps, uint256 newBps);
    event TypeConfigUpdated(ProposalType indexed proposalType, TypeConfig config);
    event GuardianUpdated(address indexed oldGuardian, address indexed newGuardian);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event LockerContractUpdated(address indexed oldLocker, address indexed newLocker);
    event ProposalDepositUpdated(uint256 oldAmount, uint256 newAmount);
    event MaxActiveProposalsUpdated(uint256 oldMax, uint256 newMax);
    event WhitelistUpdated(address indexed account, bool status);

    // ═══════════════════════════════════════════════════════════════════════
    // MODIFIERS
    // ═══════════════════════════════════════════════════════════════════════

    modifier onlyGuardian() {
        require(msg.sender == guardian, "DAO: not guardian");
        _;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════

    constructor(
        address _lockToken,
        address _treasury,
        address _guardian,
        address _lockerContract
    ) Ownable(msg.sender) {
        require(_lockToken      != address(0), "DAO: zero token");
        require(_treasury       != address(0), "DAO: zero treasury");
        require(_guardian       != address(0), "DAO: zero guardian");
        require(_lockerContract != address(0), "DAO: zero locker");
        require(_guardian       != msg.sender,  "DAO: guardian must differ from owner");

        lockToken       = IVotes(_lockToken);
        lockTokenERC20  = IERC20(_lockToken);
        treasury        = _treasury;
        guardian        = _guardian;
        lockerContract  = _lockerContract;

        // ── default governance parameters (all changeable later) ──────────
        thresholdBps       = 50;    // 0.5% of supply
        vetoThresholdBps   = 100;   // 1.0% of supply
        proposalDeposit    = 0;     // disabled at launch
        maxActiveProposals = 10;

        // ── default per-type configs ──────────────────────────────────────
        typeConfigs[ProposalType.PAYMENT] = TypeConfig({
            quorum           : 150,
            passBps          : 5100,  // 51%
            votingDuration   : 5 days,
            timelockDelay    : 1 days,
            discussionPeriod : 2 days,
            requiresWhitelist: false
        });

        typeConfigs[ProposalType.MEMBERSHIP] = TypeConfig({
            quorum           : 150,
            passBps          : 6000,  // 60%
            votingDuration   : 5 days,
            timelockDelay    : 1 days,
            discussionPeriod : 2 days,
            requiresWhitelist: false
        });

        typeConfigs[ProposalType.PLATFORM] = TypeConfig({
            quorum           : 200,
            passBps          : 6000,  // 60%
            votingDuration   : 7 days,
            timelockDelay    : 2 days,
            discussionPeriod : 2 days,
            requiresWhitelist: false
        });

        typeConfigs[ProposalType.TREASURY] = TypeConfig({
            quorum           : 250,
            passBps          : 6600,  // 66%
            votingDuration   : 7 days,
            timelockDelay    : 3 days,
            discussionPeriod : 2 days,
            requiresWhitelist: true
        });

        // Emergency: guardian-only fast path, no quorum, no timelock
        typeConfigs[ProposalType.EMERGENCY] = TypeConfig({
            quorum           : 0,
            passBps          : 8000,  // 80% if community votes
            votingDuration   : 1 days,
            timelockDelay    : 0,
            discussionPeriod : 0,
            requiresWhitelist: true   // enforced as guardian-only in createProposal
        });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ADMIN — owner-only configuration; every setter emits an event
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Set the supply % threshold for voting and proposing (max 10%)
    function setThresholdBps(uint256 _bps) external onlyOwner {
        require(_bps > 0 && _bps <= 1000, "DAO: threshold out of range");
        emit ThresholdBpsUpdated(thresholdBps, _bps);
        thresholdBps = _bps;
    }

    /// @notice Set the supply % threshold for casting a veto vote (max 10%)
    function setVetoThresholdBps(uint256 _bps) external onlyOwner {
        require(_bps > 0 && _bps <= 1000, "DAO: veto threshold out of range");
        emit VetoThresholdBpsUpdated(vetoThresholdBps, _bps);
        vetoThresholdBps = _bps;
    }

    /// @notice Replace the full config for a proposal type
    function setTypeConfig(ProposalType _type, TypeConfig calldata _config) external onlyOwner {
        require(_config.passBps > 0 && _config.passBps <= 10_000, "DAO: invalid passBps");
        require(_config.votingDuration >= 1 hours,                 "DAO: voting too short");
        typeConfigs[_type] = _config;
        emit TypeConfigUpdated(_type, _config);
    }

    /// @notice Replace the guardian address (must differ from owner)
    function setGuardian(address _guardian) external onlyOwner {
        require(_guardian != address(0),   "DAO: zero guardian");
        require(_guardian != owner(),      "DAO: guardian must differ from owner");
        emit GuardianUpdated(guardian, _guardian);
        guardian = _guardian;
    }

    /// @notice Update the treasury address
    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "DAO: zero treasury");
        emit TreasuryUpdated(treasury, _treasury);
        treasury = _treasury;
    }

    /// @notice Update the locker protocol contract address
    function setLockerContract(address _locker) external onlyOwner {
        require(_locker != address(0), "DAO: zero locker");
        emit LockerContractUpdated(lockerContract, _locker);
        lockerContract = _locker;
    }

    /// @notice Set proposal deposit amount (0 = disabled)
    function setProposalDeposit(uint256 _amount) external onlyOwner {
        emit ProposalDepositUpdated(proposalDeposit, _amount);
        proposalDeposit = _amount;
    }

    /// @notice Set the maximum number of concurrent active proposals
    function setMaxActiveProposals(uint256 _max) external onlyOwner {
        require(_max > 0, "DAO: zero max");
        emit MaxActiveProposalsUpdated(maxActiveProposals, _max);
        maxActiveProposals = _max;
    }

    /// @notice Add or remove an address from the treasury whitelist
    function setWhitelist(address _account, bool _status) external onlyOwner {
        require(_account != address(0), "DAO: zero address");
        isWhitelisted[_account] = _status;
        emit WhitelistUpdated(_account, _status);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PROPOSAL CREATION
    // ═══════════════════════════════════════════════════════════════════════

    // ─── proposal creation params struct (avoids stack-too-deep) ───────────
    struct CreateParams {
        string       title;
        string       description;
        ProposalType proposalType;
        ActionType   actionType;
        address      actionRecipient;
        uint256      actionAmount;
        uint256      actionValueBps;
    }

    /**
     * @notice Create a new governance proposal.
     * @param p  Packed proposal parameters (see CreateParams struct).
     * @return proposalId The new proposal's ID.
     */
    function createProposal(CreateParams calldata p)
        external nonReentrant returns (uint256 proposalId)
    {
        string       calldata _title           = p.title;
        string       calldata _description     = p.description;
        ProposalType          _proposalType    = p.proposalType;
        ActionType            _actionType      = p.actionType;
        address               _actionRecipient = p.actionRecipient;
        uint256               _actionAmount    = p.actionAmount;
        uint256               _actionValueBps  = p.actionValueBps;
        // ── basic validation ──────────────────────────────────────────────
        require(bytes(_title).length > 0 && bytes(_title).length <= 200, "DAO: invalid title length");
        require(bytes(_description).length > 0,                           "DAO: empty description");
        require(activeProposalCount < maxActiveProposals,                  "DAO: active proposal cap reached");

        // Snapshot at block.number - 1:
        // Prevents last-block front-run (buying tokens in same block as proposal)
        // and flash loan attacks (borrowed tokens have zero past balance)
        uint256 snap = block.number - 1;

        TypeConfig storage cfg = typeConfigs[_proposalType];

        // ── eligibility ───────────────────────────────────────────────────
        if (_proposalType == ProposalType.EMERGENCY) {
            // Emergency proposals are guardian-only regardless of token holdings
            require(msg.sender == guardian, "DAO: emergency proposals require guardian");
        } else if (cfg.requiresWhitelist) {
            // TREASURY requires whitelist
            require(isWhitelisted[msg.sender], "DAO: treasury proposals require whitelist");
        } else {
            // All other types require 0.5% threshold
            require(
                _meetsThreshold(msg.sender, snap, thresholdBps),
                "DAO: insufficient token balance to propose"
            );
        }

        // ── treasury mutex ────────────────────────────────────────────────
        if (_proposalType == ProposalType.TREASURY) {
            require(!treasuryProposalActive, "DAO: a treasury proposal is already active");
            treasuryProposalActive = true;
        }

        // ── action validation ─────────────────────────────────────────────
        _validateAction(_proposalType, _actionType, _actionRecipient, _actionAmount, _actionValueBps);

        // ── optional deposit ──────────────────────────────────────────────
        uint256 deposit = proposalDeposit;
        if (deposit > 0) {
            require(
                lockTokenERC20.transferFrom(msg.sender, address(this), deposit),
                "DAO: deposit transfer failed"
            );
        }

        // ── store proposal ────────────────────────────────────────────────
        proposalId = ++proposalCount;
        uint256 votingStartsAt = block.timestamp + cfg.discussionPeriod;
        uint256 votingEndsAt   = votingStartsAt  + cfg.votingDuration;

        proposals[proposalId] = Proposal({
            id              : proposalId,
            title           : _title,
            description     : _description,
            proposalType    : _proposalType,
            status          : cfg.discussionPeriod > 0
                                ? ProposalStatus.DISCUSSION
                                : ProposalStatus.ACTIVE,
            proposer        : msg.sender,
            snapshotBlock   : snap,
            createdAt       : block.timestamp,
            votingStartsAt  : votingStartsAt,
            votingEndsAt    : votingEndsAt,
            timelockEndsAt  : 0,
            actionType      : _actionType,
            actionRecipient : _actionRecipient,
            actionAmount    : _actionAmount,
            actionValueBps  : _actionValueBps,
            votesFor        : 0,
            votesAgainst    : 0,
            votesAbstain    : 0,
            votesVeto       : 0,
            uniqueVoters    : 0,
            deposit         : deposit,
            depositRefunded : false
        });

        activeProposalCount++;

        emit ProposalCreated(
            proposalId, msg.sender, _proposalType, _actionType,
            _title, votingStartsAt, votingEndsAt
        );
    }

    // ═══════════════════════════════════════════════════════════════════════
    // VOTING
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Cast a vote on an active proposal.
     *         Voting power = LOCK balance at proposal snapshot block.
     *         Veto requires vetoThresholdBps% of supply at snapshot.
     */
    function castVote(uint256 _proposalId, VoteType _voteType) external nonReentrant {
        Proposal storage p = proposals[_proposalId];

        require(p.id != 0,                             "DAO: proposal does not exist");
        require(p.status == ProposalStatus.ACTIVE,     "DAO: proposal is not active");
        require(block.timestamp >= p.votingStartsAt,   "DAO: still in discussion period");
        require(block.timestamp <  p.votingEndsAt,     "DAO: voting period has ended");
        require(!hasVoted[_proposalId][msg.sender],    "DAO: already voted");

        // Veto requires higher holding threshold
        uint256 requiredBps = _voteType == VoteType.VETO ? vetoThresholdBps : thresholdBps;
        require(
            _meetsThreshold(msg.sender, p.snapshotBlock, requiredBps),
            _voteType == VoteType.VETO
                ? "DAO: insufficient tokens to veto"
                : "DAO: insufficient tokens to vote"
        );

        uint256 weight = lockToken.getPastVotes(msg.sender, p.snapshotBlock);
        require(weight > 0, "DAO: zero voting weight at snapshot");

        // Record vote
        hasVoted[_proposalId][msg.sender]  = true;
        voteRecord[_proposalId][msg.sender] = _voteType;
        p.uniqueVoters++;

        if (_voteType == VoteType.FOR)     { p.votesFor     += weight; }
        if (_voteType == VoteType.AGAINST) { p.votesAgainst += weight; }
        if (_voteType == VoteType.ABSTAIN) { p.votesAbstain += weight; }
        if (_voteType == VoteType.VETO)    { p.votesVeto    += weight; }

        emit VoteCast(_proposalId, msg.sender, _voteType, weight);

        // Check veto after each vote — kill immediately if threshold crossed
        _checkVetoThreshold(p);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PROPOSAL LIFECYCLE
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Transition a DISCUSSION proposal to ACTIVE once the discussion
     *         period has elapsed. Anyone can call this.
     */
    function openVoting(uint256 _proposalId) external {
        Proposal storage p = proposals[_proposalId];
        require(p.id != 0,                                "DAO: proposal does not exist");
        require(p.status == ProposalStatus.DISCUSSION,    "DAO: not in discussion");
        require(block.timestamp >= p.votingStartsAt,      "DAO: discussion period not over");
        p.status = ProposalStatus.ACTIVE;
        emit VotingOpened(_proposalId);
    }

    /**
     * @notice Finalise a proposal after its voting window closes.
     *         Transitions to QUEUED (passed) or DEFEATED.
     *         Anyone can call this after votingEndsAt.
     */
    function finaliseProposal(uint256 _proposalId) external {
        Proposal storage p = proposals[_proposalId];
        require(p.id != 0,                          "DAO: proposal does not exist");
        require(p.status == ProposalStatus.ACTIVE,  "DAO: not active");
        require(block.timestamp >= p.votingEndsAt,  "DAO: voting not yet over");

        TypeConfig storage cfg = typeConfigs[p.proposalType];

        if (_isPassed(p, cfg)) {
            p.status         = ProposalStatus.QUEUED;
            p.timelockEndsAt = block.timestamp + cfg.timelockDelay;
            _refundDeposit(p);
            emit ProposalQueued(_proposalId, p.timelockEndsAt);
        } else {
            p.status = ProposalStatus.DEFEATED;
            _burnDeposit(p);
            _clearActive(p);
            emit ProposalDefeated(_proposalId);
        }
    }

    /**
     * @notice Execute a QUEUED proposal after its timelock expires.
     *         Anyone can call this — execution is permissionless once timelock passes.
     */
    function executeProposal(uint256 _proposalId) external nonReentrant {
        Proposal storage p = proposals[_proposalId];
        require(p.id != 0,                          "DAO: proposal does not exist");
        require(p.status == ProposalStatus.QUEUED,  "DAO: not queued");
        require(block.timestamp >= p.timelockEndsAt,"DAO: timelock has not expired");

        p.status = ProposalStatus.EXECUTED;
        _clearActive(p);
        _executeAction(p);
        emit ProposalExecuted(_proposalId);
    }

    /**
     * @notice Cancel a proposal before any votes are cast.
     *         Only the proposer or contract owner may cancel.
     */
    function cancelProposal(uint256 _proposalId) external {
        Proposal storage p = proposals[_proposalId];
        require(p.id != 0, "DAO: proposal does not exist");
        require(
            p.status == ProposalStatus.DISCUSSION || p.status == ProposalStatus.ACTIVE,
            "DAO: cannot cancel at this stage"
        );
        require(
            msg.sender == p.proposer || msg.sender == owner(),
            "DAO: not proposer or owner"
        );
        // Prevent hiding a losing result: no cancels after first vote
        require(
            p.votesFor + p.votesAgainst + p.votesAbstain + p.votesVeto == 0,
            "DAO: cannot cancel after votes cast"
        );

        p.status = ProposalStatus.CANCELLED;
        _refundDeposit(p);
        _clearActive(p);
        emit ProposalCancelled(_proposalId);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // INTERNAL — action execution (typed fields only; no arbitrary calldata)
    // ═══════════════════════════════════════════════════════════════════════

    function _executeAction(Proposal storage p) internal {
        ActionType action = p.actionType;

        if (action == ActionType.NONE) {
            // Signal-only proposal — no on-chain side effect
            return;
        }

        if (action == ActionType.TRANSFER) {
            // Transfer LOCK tokens held by this DAO contract to the recipient
            require(p.actionRecipient != address(0), "DAO: zero recipient");
            require(p.actionAmount > 0,              "DAO: zero transfer amount");
            require(
                lockTokenERC20.transfer(p.actionRecipient, p.actionAmount),
                "DAO: token transfer failed"
            );
            return;
        }

        if (action == ActionType.ADD_MEMBER) {
            require(p.actionRecipient != address(0), "DAO: zero address");
            isWhitelisted[p.actionRecipient] = true;
            emit WhitelistUpdated(p.actionRecipient, true);
            return;
        }

        if (action == ActionType.REMOVE_MEMBER) {
            require(p.actionRecipient != address(0), "DAO: zero address");
            isWhitelisted[p.actionRecipient] = false;
            emit WhitelistUpdated(p.actionRecipient, false);
            return;
        }

        if (action == ActionType.CHANGE_PLATFORM_FEE) {
            require(p.actionValueBps <= 1000, "DAO: fee exceeds 10%");
            IGenesisLocker(lockerContract).setCreationFee(p.actionValueBps);
            return;
        }

        if (action == ActionType.PAUSE_PROTOCOL) {
            IGenesisLocker(lockerContract).pause();
            return;
        }

        if (action == ActionType.UNPAUSE_PROTOCOL) {
            IGenesisLocker(lockerContract).unpause();
            return;
        }

        revert("DAO: unknown action type");
    }

    // ═══════════════════════════════════════════════════════════════════════
    // INTERNAL — helpers
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @dev Check whether an account held >= bps% of supply at the given block.
     *      Uses historical supply and votes to support Stage 3 self-governance.
     */
    function _meetsThreshold(
        address _account,
        uint256 _block,
        uint256 _bps
    ) internal view returns (bool) {
        uint256 supply    = lockToken.getPastTotalSupply(_block);
        if (supply == 0) return false;
        uint256 threshold = supply * _bps / 10_000;
        uint256 votes     = lockToken.getPastVotes(_account, _block);
        return votes >= threshold;
    }

    /**
     * @dev Determine whether a proposal passed.
     *      Quorum  = For + Against + Abstain  (Abstain counts as participation)
     *      Pass    = For / (For + Against)    (Abstain EXCLUDED from ratio)
     *      This prevents abstain votes from gaming the pass/fail outcome.
     */
    function _isPassed(
        Proposal storage p,
        TypeConfig storage cfg
    ) internal view returns (bool) {
        // Quorum check (Abstain included, Veto not — veto kills separately)
        uint256 participation = p.votesFor + p.votesAgainst + p.votesAbstain;
        if (participation < cfg.quorum) return false;

        // Pass ratio check (Abstain excluded)
        uint256 decisive = p.votesFor + p.votesAgainst;
        if (decisive == 0) return false;  // edge: only abstains, no real votes

        return (p.votesFor * 10_000 / decisive) >= cfg.passBps;
    }

    /**
     * @dev After each veto vote, check whether total veto weight has crossed
     *      vetoThresholdBps% of snapshot supply. If so, kill the proposal immediately.
     */
    function _checkVetoThreshold(Proposal storage p) internal {
        if (p.status != ProposalStatus.ACTIVE) return;

        uint256 supply        = lockToken.getPastTotalSupply(p.snapshotBlock);
        uint256 vetoThreshold = supply * vetoThresholdBps / 10_000;

        if (p.votesVeto >= vetoThreshold) {
            p.status = ProposalStatus.VETOED;
            // Deposit returned on veto — proposer not necessarily malicious
            _refundDeposit(p);
            _clearActive(p);
            emit ProposalVetoed(p.id);
        }
    }

    /// @dev Refund deposit to the proposer (safe: checks depositRefunded flag)
    function _refundDeposit(Proposal storage p) internal {
        if (p.deposit > 0 && !p.depositRefunded) {
            p.depositRefunded = true;
            lockTokenERC20.transfer(p.proposer, p.deposit);
            emit DepositRefunded(p.id, p.proposer, p.deposit);
        }
    }

    /// @dev Burn deposit by sending it to the treasury (defeated proposals)
    function _burnDeposit(Proposal storage p) internal {
        if (p.deposit > 0 && !p.depositRefunded) {
            p.depositRefunded = true;
            lockTokenERC20.transfer(treasury, p.deposit);
            emit DepositBurned(p.id, p.deposit);
        }
    }

    /// @dev Decrement active count and release treasury mutex if applicable
    function _clearActive(Proposal storage p) internal {
        if (activeProposalCount > 0) activeProposalCount--;
        if (p.proposalType == ProposalType.TREASURY) {
            treasuryProposalActive = false;
        }
    }

    /**
     * @dev Validate that the action type is consistent with the proposal type
     *      and that required fields are present. Reverts with a clear message
     *      on any mismatch — the frontend simulation should catch these first.
     */
    function _validateAction(
        ProposalType _type,
        ActionType   _action,
        address      _recipient,
        uint256      _amount,
        uint256      _valueBps
    ) internal pure {
        if (_type == ProposalType.PAYMENT) {
            require(
                _action == ActionType.TRANSFER || _action == ActionType.NONE,
                "DAO: payment proposal must use TRANSFER or NONE"
            );
            if (_action == ActionType.TRANSFER) {
                require(_recipient != address(0), "DAO: zero recipient");
                require(_amount > 0,              "DAO: zero amount");
            }
            return;
        }

        if (_type == ProposalType.MEMBERSHIP) {
            require(
                _action == ActionType.ADD_MEMBER || _action == ActionType.REMOVE_MEMBER,
                "DAO: membership proposal must use ADD_MEMBER or REMOVE_MEMBER"
            );
            require(_recipient != address(0), "DAO: zero member address");
            return;
        }

        if (_type == ProposalType.PLATFORM) {
            require(
                _action == ActionType.CHANGE_PLATFORM_FEE || _action == ActionType.NONE,
                "DAO: platform proposal must use CHANGE_PLATFORM_FEE or NONE"
            );
            if (_action == ActionType.CHANGE_PLATFORM_FEE) {
                require(_valueBps <= 1000, "DAO: fee cannot exceed 10%");
            }
            return;
        }

        if (_type == ProposalType.TREASURY) {
            require(_action == ActionType.TRANSFER, "DAO: treasury proposal must use TRANSFER");
            require(_recipient != address(0),       "DAO: zero recipient");
            require(_amount > 0,                    "DAO: zero amount");
            return;
        }

        if (_type == ProposalType.EMERGENCY) {
            require(
                _action == ActionType.PAUSE_PROTOCOL || _action == ActionType.UNPAUSE_PROTOCOL,
                "DAO: emergency proposal must use PAUSE_PROTOCOL or UNPAUSE_PROTOCOL"
            );
            return;
        }

        revert("DAO: unknown proposal type");
    }

    // ═══════════════════════════════════════════════════════════════════════
    // VIEWS
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Fetch a full proposal record
    function getProposal(uint256 _id) external view returns (Proposal memory) {
        require(proposals[_id].id != 0, "DAO: proposal does not exist");
        return proposals[_id];
    }

    /// @notice Voting weight an account had at a proposal's snapshot block
    function getVotingWeight(address _account, uint256 _proposalId)
        external view returns (uint256)
    {
        require(proposals[_proposalId].id != 0, "DAO: proposal does not exist");
        return lockToken.getPastVotes(_account, proposals[_proposalId].snapshotBlock);
    }

    /// @notice Whether an account is eligible to vote on a specific proposal
    function isEligibleToVote(address _account, uint256 _proposalId)
        external view returns (bool)
    {
        uint256 snap = proposals[_proposalId].snapshotBlock;
        if (snap == 0) return false;
        return _meetsThreshold(_account, snap, thresholdBps);
    }

    /// @notice Whether an account is currently eligible to create a proposal
    function isEligibleToPropose(address _account) external view returns (bool) {
        if (block.number == 0) return false;
        return _meetsThreshold(_account, block.number - 1, thresholdBps);
    }

    /// @notice Minimum token amount required to vote (based on current supply)
    function currentVoteThreshold() external view returns (uint256) {
        return lockToken.getPastTotalSupply(block.number - 1) * thresholdBps / 10_000;
    }

    /// @notice Minimum token amount required to cast a veto (based on current supply)
    function currentVetoThreshold() external view returns (uint256) {
        return lockToken.getPastTotalSupply(block.number - 1) * vetoThresholdBps / 10_000;
    }

    /// @notice Quorum progress for a proposal (current participation vs required)
    function quorumProgress(uint256 _proposalId)
        external view returns (uint256 current, uint256 required)
    {
        Proposal storage p   = proposals[_proposalId];
        TypeConfig storage cfg = typeConfigs[p.proposalType];
        current  = p.votesFor + p.votesAgainst + p.votesAbstain;
        required = cfg.quorum;
    }

    /// @notice Live pass ratio: For/(For+Against) in bps. 0 if no decisive votes.
    function passRatioBps(uint256 _proposalId) external view returns (uint256) {
        Proposal storage p = proposals[_proposalId];
        uint256 decisive   = p.votesFor + p.votesAgainst;
        if (decisive == 0) return 0;
        return p.votesFor * 10_000 / decisive;
    }

    /**
     * @notice Virtual status — accounts for discussion→active transition without
     *         requiring a transaction. Call openVoting() to persist on-chain.
     */
    function currentStatus(uint256 _proposalId) external view returns (ProposalStatus) {
        Proposal storage p = proposals[_proposalId];
        require(p.id != 0, "DAO: proposal does not exist");
        if (p.status == ProposalStatus.DISCUSSION && block.timestamp >= p.votingStartsAt) {
            return ProposalStatus.ACTIVE;
        }
        return p.status;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // RECEIVE — accept ETH sent to the DAO treasury
    // ═══════════════════════════════════════════════════════════════════════

    receive() external payable {}
}
