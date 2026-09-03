import unittest

import main as rats


class RecipeBotFleetTests(unittest.TestCase):
    def test_every_machine_has_recipe_bot_file_channel(self):
        missing = [
            machine_id
            for machine_id, info in rats.MACHINE_DB.items()
            if int(info.get("bot_file_port", 0)) != 5003
        ]
        self.assertEqual(missing, [])

    def test_uploaded_config_is_personalized_for_selected_machine(self):
        source = b"[file_channel]\r\nmachine_id = WB#82\r\nfile_listen_port = 5003\r\n"
        result = rats._personalize_recipe_bot_config(source, "WB#87").decode("utf-8")
        self.assertIn("machine_id = WB#87", result)
        self.assertNotIn("machine_id = WB#82", result)
        self.assertIn("file_listen_port = 5003", result)

    def test_machine_id_is_added_if_template_omits_it(self):
        result = rats._personalize_recipe_bot_config(
            b"[file_channel]\nfile_listen_port = 5003\n",
            "WB#76",
        ).decode("utf-8")
        self.assertIn("machine_id = WB#76", result)

    def test_channel_identity_is_authoritative_for_legacy_configs(self):
        effective_machine, legacy_reported_machine = rats._resolve_recipe_bot_machine_id(
            "WB#84",
            "WB#82",
        )
        self.assertEqual(effective_machine, "WB#84")
        self.assertEqual(legacy_reported_machine, "WB#82")


if __name__ == "__main__":
    unittest.main()
