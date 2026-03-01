from python_analysis.base_analyzer import BaseAnalyzer

_REGISTRY = {}


def _lazy_load():
    if _REGISTRY:
        return

    from .tennis_forehand import TennisForehandAnalyzer
    from .tennis_backhand import TennisBackhandAnalyzer
    from .tennis_serve import TennisServeAnalyzer
    from .tennis_volley import TennisVolleyAnalyzer
    from .tennis_game import TennisGameAnalyzer
    from .golf_drive import GolfDriveAnalyzer
    from .golf_iron import GolfIronAnalyzer
    from .golf_chip import GolfChipAnalyzer
    from .golf_putt import GolfPuttAnalyzer
    from .golf_full_swing import GolfFullSwingAnalyzer

    _REGISTRY["tennis-forehand"] = TennisForehandAnalyzer
    _REGISTRY["tennis-backhand"] = TennisBackhandAnalyzer
    _REGISTRY["tennis-serve"] = TennisServeAnalyzer
    _REGISTRY["tennis-volley"] = TennisVolleyAnalyzer
    _REGISTRY["tennis-game"] = TennisGameAnalyzer
    _REGISTRY["golf-drive"] = GolfDriveAnalyzer
    _REGISTRY["golf-iron"] = GolfIronAnalyzer
    _REGISTRY["golf-chip"] = GolfChipAnalyzer
    _REGISTRY["golf-putt"] = GolfPuttAnalyzer
    _REGISTRY["golf-full-swing"] = GolfFullSwingAnalyzer


def get_analyzer(config_key: str) -> BaseAnalyzer:
    _lazy_load()
    cls = _REGISTRY.get(config_key)
    if cls is None:
        available = ", ".join(sorted(_REGISTRY.keys()))
        raise ValueError(f"Unknown config key '{config_key}'. Available: {available}")
    return cls()
