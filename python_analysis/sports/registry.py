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
    from .pickleball_dink import PickleballDinkAnalyzer
    from .pickleball_drive import PickleballDriveAnalyzer
    from .pickleball_serve import PickleballServeAnalyzer
    from .pickleball_volley import PickleballVolleyAnalyzer
    from .pickleball_third_shot_drop import PickleballThirdShotDropAnalyzer
    from .paddle_forehand import PaddleForehandAnalyzer
    from .paddle_backhand import PaddleBackhandAnalyzer
    from .paddle_serve import PaddleServeAnalyzer
    from .paddle_smash import PaddleSmashAnalyzer
    from .paddle_bandeja import PaddleBandejaAnalyzer
    from .badminton_clear import BadmintonClearAnalyzer
    from .badminton_smash import BadmintonSmashAnalyzer
    from .badminton_drop import BadmintonDropAnalyzer
    from .badminton_net_shot import BadmintonNetShotAnalyzer
    from .badminton_serve import BadmintonServeAnalyzer
    from .tabletennis_forehand import TableTennisForehandAnalyzer
    from .tabletennis_backhand import TableTennisBackhandAnalyzer
    from .tabletennis_serve import TableTennisServeAnalyzer
    from .tabletennis_loop import TableTennisLoopAnalyzer
    from .tabletennis_chop import TableTennisChopAnalyzer

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
    _REGISTRY["pickleball-dink"] = PickleballDinkAnalyzer
    _REGISTRY["pickleball-drive"] = PickleballDriveAnalyzer
    _REGISTRY["pickleball-serve"] = PickleballServeAnalyzer
    _REGISTRY["pickleball-volley"] = PickleballVolleyAnalyzer
    _REGISTRY["pickleball-third-shot-drop"] = PickleballThirdShotDropAnalyzer
    _REGISTRY["paddle-forehand"] = PaddleForehandAnalyzer
    _REGISTRY["paddle-backhand"] = PaddleBackhandAnalyzer
    _REGISTRY["paddle-serve"] = PaddleServeAnalyzer
    _REGISTRY["paddle-smash"] = PaddleSmashAnalyzer
    _REGISTRY["paddle-bandeja"] = PaddleBandejaAnalyzer
    _REGISTRY["badminton-clear"] = BadmintonClearAnalyzer
    _REGISTRY["badminton-smash"] = BadmintonSmashAnalyzer
    _REGISTRY["badminton-drop"] = BadmintonDropAnalyzer
    _REGISTRY["badminton-net-shot"] = BadmintonNetShotAnalyzer
    _REGISTRY["badminton-serve"] = BadmintonServeAnalyzer
    _REGISTRY["tabletennis-forehand"] = TableTennisForehandAnalyzer
    _REGISTRY["tabletennis-backhand"] = TableTennisBackhandAnalyzer
    _REGISTRY["tabletennis-serve"] = TableTennisServeAnalyzer
    _REGISTRY["tabletennis-loop"] = TableTennisLoopAnalyzer
    _REGISTRY["tabletennis-chop"] = TableTennisChopAnalyzer


def get_analyzer(config_key: str) -> BaseAnalyzer:
    _lazy_load()
    cls = _REGISTRY.get(config_key)
    if cls is None:
        available = ", ".join(sorted(_REGISTRY.keys()))
        raise ValueError(f"Unknown config key '{config_key}'. Available: {available}")
    return cls()
