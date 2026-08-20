# Contributing to urlscan-submitter

Thank you for your interest in contributing! We welcome bug reports, feature requests, and pull requests.

## Development Setup

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd urlscan-submitter
   ```

2. **Set up a virtual environment (recommended):**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows use `venv\Scripts\activate`
   ```

3. **Install the tool in editable mode with development dependencies:**
   ```bash
   pip install -e ".[dev]"
   ```

## Running Tests

We use Python's built-in `unittest` framework. Before submitting a Pull Request, please ensure all tests pass:

```bash
python -m unittest discover tests/
```

Alternatively, if you prefer `pytest` (which is included in the `dev` dependencies):

```bash
pytest tests/
```

## Submitting Changes

1. Fork the repository and create your branch from `main`.
2. Make your changes, ensuring you write tests for any new functionality.
3. Update `README.md` and `CHANGELOG.md` if your changes impact user-facing behavior.
4. Open a Pull Request!

## Code Style

- We generally follow [PEP 8](https://peps.python.org/pep-0008/) for Python code.
- An `.editorconfig` file is provided to help maintain consistent indentation (4 spaces for Python, 2 spaces for JS/Web).
