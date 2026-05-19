def __getattr__(name):
    if name in ("Puzzle", "EinsteinModel", "print_solution"):
        from .framework import Puzzle, EinsteinModel, print_solution
        return {"Puzzle": Puzzle, "EinsteinModel": EinsteinModel, "print_solution": print_solution}[name]
    if name in (
        "InterviewResult", "NPC_CONTACTS", "NOIR_ARCHETYPES", "PAYOFF_MATRIX",
        "STRATEGY_CLASS_MAP", "generate_clue_map", "run_tournament",
        "simulate_interview", "validate_game_data",
        "generate_interview_clue_interactables", "merge_interview_clues_into_game_data",
    ):
        from . import interview as _interview
        return getattr(_interview, name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
