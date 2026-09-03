"""Combined machine registry kept as the stable import point for the system.

Production-line data lives in separate modules so each section can be updated
independently without changing the backend, Section Manager, or test tools.
"""

from Advanced_Wirebond import MACHINE_DB as ADVANCED_MACHINE_DB
from Advanced_Wirebond import SERIAL_TO_MACHINE as ADVANCED_SERIAL_TO_MACHINE
from IC_WireBond import MACHINE_DB as IC_MACHINE_DB
from IC_WireBond import SERIAL_TO_MACHINE as IC_SERIAL_TO_MACHINE


def _merge_unique(label, *registries):
    merged = {}
    for registry in registries:
        duplicates = merged.keys() & registry.keys()
        if duplicates:
            duplicate_list = ", ".join(sorted(duplicates))
            raise ValueError(f"Duplicate {label}: {duplicate_list}")
        merged.update(registry)
    return merged


MACHINE_DB = _merge_unique("machine IDs", ADVANCED_MACHINE_DB, IC_MACHINE_DB)
SERIAL_TO_MACHINE = _merge_unique(
    "machine serials",
    ADVANCED_SERIAL_TO_MACHINE,
    IC_SERIAL_TO_MACHINE,
)
