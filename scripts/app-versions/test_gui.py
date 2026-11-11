import unittest
from gui import VersionManager


class WindowTests(unittest.TestCase):
    def setUp(self):
        self.app = VersionManager(offline=True)
        self.app.update()

    def tearDown(self):
        self.app.destroy()

    def test_main_actions_fit_window(self):
        bottom = self.app.winfo_rooty() + self.app.winfo_height()
        right = self.app.winfo_rootx() + self.app.winfo_width()
        for button in self.app.actions:
            self.assertTrue(button.winfo_ismapped())
            self.assertLessEqual(button.winfo_rooty() + button.winfo_height(), bottom)
            self.assertLessEqual(button.winfo_rootx() + button.winfo_width(), right)

    def test_form_and_selection_preserve_version_settings(self):
        row = dict(_id='one', version='1.7.9', type='native_app', uni_platform='android',
                   title='迁移更新', contents='保留旧版升级入口', url='https://example.test/app.apk',
                   stable_publish=False, is_mandatory=True, is_silently=False,
                   legacy_migration=True, revision=1)
        self.app.rows = {'one': row}
        self.app.tree.insert('', 'end', iid='one', values=('1.7.9', 'Android / 整包', '草稿'))
        self.app.tree.selection_set('one')
        self.app.select()
        form = self.app.record()
        for key in ('version', 'type', 'uni_platform', 'title', 'contents', 'is_mandatory', 'legacy_migration'):
            self.assertEqual(form[key], row[key])
        self.app.new()
        self.assertIsNone(self.app.current)
        self.assertFalse(self.app.record()['legacy_migration'])


if __name__ == '__main__':
    unittest.main()
