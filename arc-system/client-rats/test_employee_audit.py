import asyncio
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException

os.environ.setdefault("RATS_OPERATOR_PASSWORD", "test-operator-password")
os.environ.setdefault("RATS_ADMIN_PASSWORD", "test-admin-password")

import main as rats


class EmployeeAuditTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.original_path = rats.EMPLOYEE_AUDIT_PATH
        self.original_records = rats.employee_audit_sessions
        self.original_sessions = rats.sessions
        rats.EMPLOYEE_AUDIT_PATH = Path(self.temp.name) / "employee_audit.json"
        rats.employee_audit_sessions = []
        rats.sessions = {}

    def tearDown(self):
        rats.EMPLOYEE_AUDIT_PATH = self.original_path
        rats.employee_audit_sessions = self.original_records
        rats.sessions = self.original_sessions
        self.temp.cleanup()

    def login(self, employee_number="32340", username="operator", password="test-operator-password"):
        response = asyncio.run(rats.login({
            "employee_number": employee_number,
            "username": username,
            "password": password,
        }))
        return response, json.loads(response.body)

    def test_employee_number_is_required(self):
        response, body = self.login(employee_number="")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(body["error"], "Employee Number is required")
        self.assertEqual(rats.employee_audit_sessions, [])

    def test_operator_push_is_allowed_and_logged_until_logout(self):
        response, login = self.login()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(login["employee_number"], "32340")

        with patch.object(rats, "run_push", return_value={"status": "ok", "ackc7": 0}):
            push_response = asyncio.run(rats.push_program(
                "WB#82",
                {"program_name": "BD-M02-ST-2300_EX"},
                login["token"],
            ))
        self.assertEqual(push_response.status_code, 200)
        record = rats.employee_audit_sessions[0]
        self.assertEqual(record["employee_number"], "32340")
        self.assertEqual(record["role"], "Operator")
        self.assertEqual(record["actions"][0]["action"], "PUSH_RECIPE")
        self.assertEqual(record["actions"][0]["machine_id"], "WB#82")
        self.assertEqual(record["actions"][0]["recipe"], "BD-M02-ST-2300_EX")

        asyncio.run(rats.logout(login["token"]))
        self.assertIsNotNone(record["logout_at"])
        self.assertEqual(record["logout_reason"], "logout")
        self.assertTrue(rats.EMPLOYEE_AUDIT_PATH.is_file())

    def test_operator_cannot_view_audit_but_admin_can(self):
        _, operator = self.login()
        with self.assertRaises(HTTPException) as denied:
            asyncio.run(rats.employee_audit_log(200, operator["token"]))
        self.assertEqual(denied.exception.status_code, 403)

        _, admin = self.login("90001", "admin", "test-admin-password")
        response = asyncio.run(rats.employee_audit_log(200, admin["token"]))
        body = json.loads(response.body)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(body["sessions"][0]["employee_number"], "90001")

    def test_operator_cannot_delete_recipe(self):
        _, operator = self.login()
        with self.assertRaises(HTTPException) as denied:
            asyncio.run(rats.delete_program(
                "WB#82",
                {"program_name": "BD-M02-ST-2300_EX"},
                operator["token"],
            ))
        self.assertEqual(denied.exception.status_code, 403)


if __name__ == "__main__":
    unittest.main()
