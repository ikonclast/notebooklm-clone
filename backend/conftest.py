"""pytest-Setup: backend/ auf den Importpfad legen, damit Tests `from services…`,
`from models…`, `from config import` exakt wie die App auflösen."""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
