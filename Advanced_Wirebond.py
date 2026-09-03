"""Machine configuration for the WB Advanced production line."""

PRODUCTION_SECTION = "WB_ADVANCED"


def _machine(number, ip):
    offset = number - 76
    return {
        "name": f"Wire Bonder #{number}",
        "production_section": PRODUCTION_SECTION,
        "ip": ip,
        "port": 5001,
        "bot_file_port": 5003,
        "deploy_port": 5004,
        "session_id": 0,
        "map_position": {"row": (offset // 8) + 1, "column": (offset % 8) + 1},
    }


# WB#76–WB#84 previously used 169.254.13.x.
# WB#85–WB#90 previously used 192.168.11.x.
MACHINE_DB = {
    "WB#76": _machine(76, "192.168.10.76"),
    "WB#77": _machine(77, "192.168.10.77"),
    "WB#78": _machine(78, "192.168.10.78"),
    "WB#79": _machine(79, "192.168.10.79"),
    "WB#80": _machine(80, "192.168.10.80"),
    "WB#81": _machine(81, "192.168.10.81"),
    "WB#82": _machine(82, "192.168.11.82"),
    "WB#83": _machine(83, "192.168.11.83"),
    "WB#84": _machine(84, "192.168.10.84"),
    "WB#85": _machine(85, "192.168.10.85"),
    "WB#86": _machine(86, "192.168.10.86"),
    "WB#87": _machine(87, "192.168.10.87"),
    "WB#88": _machine(88, "192.168.10.88"),
    "WB#89": _machine(89, "192.168.10.89"),
    "WB#90": _machine(90, "192.168.10.90"),
}

SERIAL_TO_MACHINE = {machine_id: machine_id for machine_id in MACHINE_DB}
SERIAL_TO_MACHINE.update({
    "IX01-023": "WB#82",
    "IX01-025": "WB#83",
    "IX01-028": "WB#84",
})
