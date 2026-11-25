# Contributing to ProductSuite

> [!IMPORTANT]
> **ProductSuite is proprietary, source-available software.** By viewing this repository, you are not granted an open-source license. See [LICENSE](./LICENSE) and [LICENSING.md](./LICENSING.md).

## Contribution Requirements

1. **Rights & Authorization:** No contributor may submit code, documentation, or assets without owning or holding full legal rights and written authorization to assign or license those contributions to `[PROJECT_OWNER_LEGAL_NAME / COMPANY_NAME]` under the proprietary terms of this repository.
2. **Dependency Policy:** Do not introduce any dependency licensed under GPL, AGPL, LGPL, SSPL, or any license incompatible with proprietary distribution. All new dependencies must be audited and recorded in [THIRD_PARTY_LICENSES.md](./THIRD_PARTY_LICENSES.md).
3. **No Secrets:** Never commit `.env` files, API keys, tokens, passwords, or private keys.
4. **Code Quality & Testing:**
   - Python: Must pass `ruff check`, `ruff format --check`, and `pytest`.
   - TypeScript/React: Must pass `tsc --noEmit`, `vitest run`, and `vite build`.
5. **Commit Discipline:** Each product or platform milestone is committed independently with clear conventional commit messages (e.g., `feat(formforge): implement forms application`).
