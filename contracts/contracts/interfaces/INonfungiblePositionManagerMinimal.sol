// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice Minimal, hand-declared subset of Uniswap V3 periphery's
/// INonfungiblePositionManager ABI (mint/positions/collect/decreaseLiquidity/factory).
///
/// The real "uniswap slash v3-periphery" npm package's Solidity interface source
/// (INonfungiblePositionManager.sol) transitively imports an IERC721Metadata.sol path
/// that no longer exists in OpenZeppelin Contracts v5 (this repo's installed version,
/// 5.1.0-plus) - it moved under an "extensions" subfolder. Rather than pin a second,
/// older OZ version just to satisfy that one transitive import, this interface declares
/// only the exact function signatures GenesisV3PositionLocker actually calls. Solidity
/// dispatches calls by selector, so this is fully ABI-compatible with the real deployed
/// NonfungiblePositionManager regardless of which source declared the interface -
/// verified against the real contract in the Requirement 2/3 fork-validation harnesses.
interface INonfungiblePositionManagerMinimal {
    struct MintParams {
        address token0;
        address token1;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint256 amount0Desired;
        uint256 amount1Desired;
        uint256 amount0Min;
        uint256 amount1Min;
        address recipient;
        uint256 deadline;
    }

    struct DecreaseLiquidityParams {
        uint256 tokenId;
        uint128 liquidity;
        uint256 amount0Min;
        uint256 amount1Min;
        uint256 deadline;
    }

    struct CollectParams {
        uint256 tokenId;
        address recipient;
        uint128 amount0Max;
        uint128 amount1Max;
    }

    function mint(
        MintParams calldata params
    ) external payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1);

    function positions(
        uint256 tokenId
    )
        external
        view
        returns (
            uint96 nonce,
            address operator,
            address token0,
            address token1,
            uint24 fee,
            int24 tickLower,
            int24 tickUpper,
            uint128 liquidity,
            uint256 feeGrowthInside0LastX128,
            uint256 feeGrowthInside1LastX128,
            uint128 tokensOwed0,
            uint128 tokensOwed1
        );

    function decreaseLiquidity(
        DecreaseLiquidityParams calldata params
    ) external payable returns (uint256 amount0, uint256 amount1);

    function collect(CollectParams calldata params) external payable returns (uint256 amount0, uint256 amount1);

    function factory() external view returns (address);

    function createAndInitializePoolIfNecessary(
        address token0,
        address token1,
        uint24 fee,
        uint160 sqrtPriceX96
    ) external payable returns (address pool);
}
