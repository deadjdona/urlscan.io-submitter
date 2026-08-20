.PHONY: install install-dev test clean help

help:
	@echo "Available commands:"
	@echo "  make install      - Install the tool for standard usage"
	@echo "  make install-dev  - Install the tool in editable mode with test dependencies"
	@echo "  make test         - Run the unit tests"
	@echo "  make clean        - Remove Python build artifacts and cache files"

install:
	pip install .

install-dev:
	pip install -e ".[dev]"

test:
	python3 -m unittest discover tests/

clean:
	rm -rf __pycache__/
	rm -rf tests/__pycache__/
	rm -rf .pytest_cache/
	rm -rf *.egg-info/
	rm -rf build/
	rm -rf dist/
	find . -type f -name '*.pyc' -delete
	find . -type f -name '*.pyo' -delete
	find . -type f -name '*~' -delete
