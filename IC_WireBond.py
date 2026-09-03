"""Machine configuration for the IC Wire Bond production line."""

PRODUCTION_SECTION = "IC_WIRE_BOND"

# WB#70 previously used 10.10.101.70.
MACHINE_DB = {
    "WB#70": {
        "name": "Wire Bonder #70",
        "production_section": PRODUCTION_SECTION,
        "ip": "192.168.11.70",
        "port": 5001,
        "bot_file_port": 5003,
        "deploy_port": 5004,
        "session_id": 0,
        "map_position": {"row": 1, "column": 1},
    },
    "WB#109": {
        "name": "Wire Bonder #109",
        "production_section": PRODUCTION_SECTION,
        "ip": "192.168.10.25",
        "port": 5001,
        "bot_file_port": 5003,
        "deploy_port": 5004,
        "session_id": 0,
        "map_position": {"row": 1, "column": 2},
    },
}

SERIAL_TO_MACHINE = {machine_id: machine_id for machine_id in MACHINE_DB}
