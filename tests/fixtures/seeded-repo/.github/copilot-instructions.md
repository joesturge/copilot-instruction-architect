## Documentation

- Document meaningful changes in commit messages and inline comments.
- Public APIs must have JSDoc.
- Update README when public interfaces change.

## Testing

- Write tests for all non-trivial logic.
- Update tests when behaviour changes.
- Prefer unit tests over integration tests for pure functions.

## Security

- Never commit secrets, tokens or credentials.
- Sanitise all user input before use.
- Prefer allowlists over denylists for validation.

## Code quality

- Prefer clear and readable code over clever one-liners.
- Avoid duplication — extract shared logic into helpers.
- Remove dead code and commented-out blocks before merging.

## Collaboration

- Keep pull requests small and focused.
- Address review comments before merging.
- Resolve merge conflicts promptly.
