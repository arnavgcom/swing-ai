from importlib import import_module

from python_analysis.base_analyzer import BaseAnalyzer

_REGISTRY = {}
_ANALYZER_SPECS = {
    "tennis-forehand": ("tennis_forehand", "TennisForehandAnalyzer"),
    "tennis-backhand": ("tennis_backhand", "TennisBackhandAnalyzer"),
    "tennis-serve": ("tennis_serve", "TennisServeAnalyzer"),
    "tennis-volley": ("tennis_volley", "TennisVolleyAnalyzer"),
    "tennis-game": ("tennis_game", "TennisGameAnalyzer"),
    "golf-drive": ("golf_drive", "GolfDriveAnalyzer"),
    "golf-iron": ("golf_iron", "GolfIronAnalyzer"),
    "golf-chip": ("golf_chip", "GolfChipAnalyzer"),
    "golf-putt": ("golf_putt", "GolfPuttAnalyzer"),
    "golf-full-swing": ("golf_full_swing", "GolfFullSwingAnalyzer"),
    "pickleball-dink": ("pickleball_dink", "PickleballDinkAnalyzer"),
    "pickleball-drive": ("pickleball_drive", "PickleballDriveAnalyzer"),
    "pickleball-serve": ("pickleball_serve", "PickleballServeAnalyzer"),
    "pickleball-volley": ("pickleball_volley", "PickleballVolleyAnalyzer"),
    "pickleball-third-shot-drop": ("pickleball_third_shot_drop", "PickleballThirdShotDropAnalyzer"),
    "paddle-forehand": ("paddle_forehand", "PaddleForehandAnalyzer"),
    "paddle-backhand": ("paddle_backhand", "PaddleBackhandAnalyzer"),
    "paddle-serve": ("paddle_serve", "PaddleServeAnalyzer"),
    "paddle-smash": ("paddle_smash", "PaddleSmashAnalyzer"),
    "paddle-bandeja": ("paddle_bandeja", "PaddleBandejaAnalyzer"),
    "badminton-clear": ("badminton_clear", "BadmintonClearAnalyzer"),
    "badminton-smash": ("badminton_smash", "BadmintonSmashAnalyzer"),
    "badminton-drop": ("badminton_drop", "BadmintonDropAnalyzer"),
    "badminton-net-shot": ("badminton_net_shot", "BadmintonNetShotAnalyzer"),
    "badminton-serve": ("badminton_serve", "BadmintonServeAnalyzer"),
    "tabletennis-forehand": ("tabletennis_forehand", "TableTennisForehandAnalyzer"),
    "tabletennis-backhand": ("tabletennis_backhand", "TableTennisBackhandAnalyzer"),
    "tabletennis-serve": ("tabletennis_serve", "TableTennisServeAnalyzer"),
    "tabletennis-loop": ("tabletennis_loop", "TableTennisLoopAnalyzer"),
    "tabletennis-chop": ("tabletennis_chop", "TableTennisChopAnalyzer"),
}


def _load_analyzer_class(config_key: str):
    cls = _REGISTRY.get(config_key)
    if cls is not None:
        return cls

    spec = _ANALYZER_SPECS.get(config_key)
    if spec is None:
        available = ", ".join(sorted(_ANALYZER_SPECS.keys()))
        raise ValueError(f"Unknown config key '{config_key}'. Available: {available}")

    module_name, class_name = spec
    module = import_module(f"{__package__}.{module_name}")
    cls = getattr(module, class_name)
    _REGISTRY[config_key] = cls
    return cls


def get_analyzer(config_key: str) -> BaseAnalyzer:
    cls = _load_analyzer_class(config_key)
    return cls()
