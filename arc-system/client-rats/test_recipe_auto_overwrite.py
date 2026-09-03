import asyncio
import json
import tempfile
import unittest
from pathlib import Path

import main as rats


def pwb(ppid: str, marker: str) -> bytes:
    return f"Program Name: {ppid}\nParameter: {marker}\n".encode("ascii")


class RecipeAutoOverwriteTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.original_proxy_token = rats.PROXY_UPLOAD_TOKEN
        rats.PROXY_UPLOAD_TOKEN = "test-recipe-token"
        root = Path(self.temp.name)
        self.original_paths = (
            rats.RECIPE_DIR,
            rats.PENDING_RECIPE_DIR,
            rats.RECIPE_ARCHIVE_DIR,
        )
        rats.RECIPE_DIR = root
        rats.PENDING_RECIPE_DIR = root / ".pending"
        rats.RECIPE_ARCHIVE_DIR = root / ".archive"
        rats.pending_recipe_updates.clear()

    def tearDown(self):
        rats.PROXY_UPLOAD_TOKEN = self.original_proxy_token
        rats.RECIPE_DIR, rats.PENDING_RECIPE_DIR, rats.RECIPE_ARCHIVE_DIR = self.original_paths
        rats.pending_recipe_updates.clear()
        self.temp.cleanup()

    def upload(self, data: bytes, source_modified_ms: int = 2000):
        return asyncio.run(
            rats.receive_proxy_recipe(
                rats._MemoryRecipeRequest(data),
                rats.PROXY_UPLOAD_TOKEN,
                "WB#82",
                "AUTO-OVERWRITE-TEST",
                "NPGM0.PWB",
                None,
                str(source_modified_ms),
            )
        )

    def test_changed_duplicate_archives_and_overwrites_without_approval(self):
        destination = rats.RECIPE_DIR / "AUTO-OVERWRITE-TEST.PWB"
        old_data = pwb("AUTO-OVERWRITE-TEST", "old")
        new_data = pwb("AUTO-OVERWRITE-TEST", "new")
        destination.write_bytes(old_data)

        response = self.upload(new_data, source_modified_ms=int(destination.stat().st_mtime * 1000) + 1000)
        body = json.loads(response.body)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(body["status"], "updated_existing")
        self.assertEqual(destination.read_bytes(), new_data)
        self.assertEqual(list(rats.RECIPE_ARCHIVE_DIR.glob("*.PWB"))[0].read_bytes(), old_data)
        self.assertEqual(rats.pending_recipe_updates, {})

    def test_identical_duplicate_is_not_rewritten_or_archived(self):
        destination = rats.RECIPE_DIR / "AUTO-OVERWRITE-TEST.PWB"
        data = pwb("AUTO-OVERWRITE-TEST", "same")
        destination.write_bytes(data)

        response = self.upload(data)
        body = json.loads(response.body)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(body["status"], "identical")
        self.assertFalse(rats.RECIPE_ARCHIVE_DIR.exists())

    def test_changed_older_duplicate_does_not_replace_host_copy(self):
        destination = rats.RECIPE_DIR / "AUTO-OVERWRITE-TEST.PWB"
        old_data = pwb("AUTO-OVERWRITE-TEST", "host-newer")
        incoming_data = pwb("AUTO-OVERWRITE-TEST", "machine-older")
        destination.write_bytes(old_data)

        response = self.upload(incoming_data, source_modified_ms=1)
        body = json.loads(response.body)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(body["status"], "host_newer")
        self.assertEqual(destination.read_bytes(), old_data)
        self.assertFalse(rats.RECIPE_ARCHIVE_DIR.exists())


if __name__ == "__main__":
    unittest.main()
