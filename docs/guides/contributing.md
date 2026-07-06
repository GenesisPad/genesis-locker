# Contribution Guide

Genesis Locker is open-source and community friendly.

Contributions should preserve these rules:

- Do not allow lock duration reduction
- Do not allow changing the locked token/LP address
- Permanent lock means nobody can ever withdraw that lock
- Do not add a pause function to the locker contract
- Minimum lock duration is seven days
- Locks below 30 days are allowed but warned
- Low lock warnings trigger below 60% locked

Community multisig funds may be used for contributor grants. Grant work should be proposed publicly, tied to a clear deliverable, and reported in the monthly treasury report when paid.

Add tests for critical contract behavior and document API changes.
