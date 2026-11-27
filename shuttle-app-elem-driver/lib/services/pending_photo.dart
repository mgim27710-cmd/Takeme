import 'package:image_picker/image_picker.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// 카메라·갤러리 앱이 켜져 있는 동안 안드로이드가 우리 앱을 종료할 수 있다 (지도가 무거운 앱이라 흔하다).
/// 그러면 돌아왔을 때 앱이 처음부터 다시 켜져 기사 홈 화면이 뜨고, 찍은 사진은 사라진다.
/// 그래서 사진을 고르러 가기 전에 '어느 대화방에서 보내는 중인지'를 적어 두고,
/// 앱이 다시 켜지면 안드로이드가 보관해 둔 사진을 찾아 그 대화방으로 보낸다.
class PendingPhoto {
  static const _kRoomId = 'pending_photo_room_id';
  static const _kTitle = 'pending_photo_room_title';

  static Future<void> save(int roomId, String title) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setInt(_kRoomId, roomId);
      await prefs.setString(_kTitle, title);
    } catch (_) {}
  }

  static Future<void> clear() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_kRoomId);
      await prefs.remove(_kTitle);
    } catch (_) {}
  }

  /// 사진을 고르러 가던 대화방 (없으면 null)
  static Future<({int roomId, String title})?> read() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final id = prefs.getInt(_kRoomId);
      if (id == null) return null;
      return (roomId: id, title: prefs.getString(_kTitle) ?? '대화방');
    } catch (_) {
      return null;
    }
  }

  /// 앱이 종료된 사이에 찍거나 고른 사진을 안드로이드에서 되찾는다 (없으면 null)
  static Future<XFile?> lostFile() async {
    try {
      final r = await ImagePicker().retrieveLostData();
      if (r.isEmpty) return null;
      if (r.file != null) return r.file;
      final list = r.files;
      return (list != null && list.isNotEmpty) ? list.first : null;
    } catch (_) {
      return null;
    }
  }
}
