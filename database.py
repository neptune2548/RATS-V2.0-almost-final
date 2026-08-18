# database.py

# จำลองตารางข้อมูลเครื่องจักร (รอเปลี่ยนเป็น SQL ในอนาคต)
MACHINE_DB = {
    # รหัสบาร์โค้ด หรือ Asset Tag ที่เราสมมติขึ้นมาแปะหน้าเครื่อง
    "WB#76": {
        "name": "Wire Bonder #76",
        "ip": "169.254.13.76",
        "port": 5001,
        "session_id": 0
    },

    "WB#77": {
        "name": "Wire Bonder #77",
        "ip": "169.254.13.77",
        "port": 5001,
        "session_id": 0
    },

    "WB#78": {
        "name": "Wire Bonder #78",
        #old "ip": "192.168.10.78",
        "ip": "169.254.13.78",
        "port": 5001,
        "session_id": 0
    },

    "WB#79": {
        "name": "Wire Bonder #79",
        "ip": "169.254.13.79",
        "port": 5001,
        "session_id": 0
    },

    "WB#80": {
        "name": "Wire Bonder #80",
        "ip": "169.254.13.80",
        "port": 5001,
        "session_id": 0
    },

    "WB#81": {
        "name": "Wire Bonder #81",
        #old "ip": "192.168.10.81",
        "ip": "169.254.13.81",
        "port": 5001,
        "session_id": 0
    },
    
    "WB#82": {
        "name": "Wire Bonder #82",
        #ip": "192.168.11.82",
        "ip": "169.254.13.82",
        "port": 5001,
        "session_id": 0
    },
    "WB#83": {
        "name": "Wire Bonder #83",
        #"ip": "192.168.11.83",
        "ip": "169.254.13.83",
        "port": 5001,
        "session_id": 0
    },
    "WB#84": {
        "name": "Wire Bonder #84",
        #"ip": "192.168.11.84",
        "ip": "169.254.13.84",
        "port": 5001,
        "session_id": 0
    },

    "WB#85": {
        "name": "Wire Bonder #85",
        #"ip": "192.168.11.85",
        "ip": "169.254.13.85",
        "port": 5001,
        "session_id": 0
    },

    "WB#86": {
        "name": "Wire Bonder #86",
        "ip": "169.254.13.86",
        #"ip": "192.168.11.86",
        "port": 5001,
        "session_id": 0
    },

    "WB#87": {
        "name": "Wire Bonder #87",
        #"ip": "192.168.11.87",
        "ip": "169.254.13.87",
        "port": 5001,
        "session_id": 0
    },
    "WB#88": {
        "name": "Wire Bonder #88",
        #"ip": "192.168.11.88",
        "ip": "169.254.13.88",
        "port": 5001,
        "session_id": 0
    },
    "WB#89": {
        "name": "Wire Bonder #89",
        #"ip": "192.168.11.89",
        "ip": "169.254.13.89",
        "port": 5001,
        "session_id": 0
    },
    "WB#90": {
        "name": "Wire Bonder #90",
        #"ip": "192.168.11.90",
        "ip": "169.254.13.90",
        "port": 5001,
        "session_id": 0
    }
}
SERIAL_TO_MACHINE = {
    "WB#76": "WB#76",
    "WB#77": "WB#77",
    "WB#78": "WB#78",
    "WB#79": "WB#79",
    "WB#80": "WB#80",
    "WB#81": "WB#81",
    "WB#82": "WB#82",
    "WB#83": "WB#83",
    "WB#84": "WB#84",
    "WB#85": "WB#85",
    "WB#86": "WB#86",
    "WB#87": "WB#87",
    "WB#88": "WB#88",
    "WB#89": "WB#89",
    "WB#90": "WB#90",
    "IX01-023": "WB#82",
    "IX01-025": "WB#83",
    "IX01-028": "WB#84"
}