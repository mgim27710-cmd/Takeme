import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../../services/api_service.dart';

class PhotoGalleryScreen extends StatefulWidget {
  final int? initialVehicleId;
  final String? initialClassName;

  const PhotoGalleryScreen({
    super.key,
    this.initialVehicleId,
    this.initialClassName,
  });

  @override
  State<PhotoGalleryScreen> createState() => _PhotoGalleryScreenState();
}

class _PhotoGalleryScreenState extends State<PhotoGalleryScreen> {
  final ApiService _api = ApiService();
  final ImagePicker _picker = ImagePicker();

  bool _isLoading = true;
  bool _isUploading = false;
  String? _errorMessage;

  List<dynamic> _photos = [];

  @override
  void initState() {
    super.initState();
    _loadPhotos();
  }

  Future<void> _loadPhotos() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final res = await _api.getMediaAssets(
        vehicleId: widget.initialVehicleId,
        className: widget.initialClassName,
      );
      if (mounted) {
        setState(() {
          _photos = res;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        String msg = e.toString();
        if (msg.contains('서버에 이 기능이 아직 없습니다') || msg.contains('<!doctype') || msg.contains('<html') || msg.contains('FormatException')) {
          msg = '서버에 이 기능이 아직 없습니다(배포 필요)';
        } else {
          msg = msg.replaceFirst(RegExp(r'^Exception:\s*'), '');
        }
        setState(() {
          _errorMessage = msg;
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _pickAndUploadImages({required ImageSource source}) async {
    try {
      List<XFile> picked = [];
      if (source == ImageSource.camera) {
        final photo = await _picker.pickImage(
          source: ImageSource.camera,
          imageQuality: 85,
          maxWidth: 1920,
        );
        if (photo != null) picked.add(photo);
      } else {
        picked = await _picker.pickMultiImage(
          imageQuality: 85,
          maxWidth: 1920,
        );
      }

      if (picked.isEmpty) return;

      setState(() => _isUploading = true);

      final photoPayloads = <Map<String, dynamic>>[];
      for (final file in picked) {
        final bytes = await file.readAsBytes();
        final base64String = base64Encode(bytes);
        final ext = file.name.split('.').last.toLowerCase();
        final mime = ext == 'png'
            ? 'image/png'
            : ext == 'webp'
                ? 'image/webp'
                : 'image/jpeg';

        photoPayloads.add({
          'base64Data': 'data:$mime;base64,$base64String',
          'filename': file.name,
          'mimeType': mime,
        });
      }

      await _api.uploadMediaAssets(
        photos: photoPayloads,
        vehicleId: widget.initialVehicleId,
        className: widget.initialClassName,
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${photoPayloads.length}장의 사진이 보관함에 저장되었습니다.'),
            backgroundColor: const Color(0xFF16A34A),
          ),
        );
      }

      await _loadPhotos();
    } catch (e) {
      if (mounted) {
        String msg = e.toString();
        if (msg.contains('서버에 이 기능이 아직 없습니다') || msg.contains('<!doctype') || msg.contains('<html') || msg.contains('FormatException')) {
          msg = '서버에 이 기능이 아직 없습니다(배포 필요)';
        } else {
          msg = msg.replaceFirst(RegExp(r'^Exception:\s*'), '');
        }
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('사진 업로드 실패: $msg'),
            backgroundColor: const Color(0xFFDC2626),
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isUploading = false);
      }
    }
  }

  void _showUploadSourceSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: const Color(0xFFE2E8F0),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                '사진 보관함에 사진 올리기',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
              ),
              const SizedBox(height: 12),
              ListTile(
                leading: const CircleAvatar(
                  backgroundColor: Color(0xFFEFF6FF),
                  child: Icon(Icons.camera_alt, color: Color(0xFF2563EB)),
                ),
                title: const Text('카메라로 바로 촬영', style: TextStyle(fontWeight: FontWeight.w600)),
                subtitle: const Text('현장 사진을 즉시 촬영하여 업로드합니다.'),
                onTap: () {
                  Navigator.pop(ctx);
                  _pickAndUploadImages(source: ImageSource.camera);
                },
              ),
              ListTile(
                leading: const CircleAvatar(
                  backgroundColor: Color(0xFFF0FDF4),
                  child: Icon(Icons.photo_library, color: Color(0xFF16A34A)),
                ),
                title: const Text('앨범/갤러리에서 선택 (여러 장 가능)', style: TextStyle(fontWeight: FontWeight.w600)),
                subtitle: const Text('기기에 저장된 사진을 한 번에 여러 장 선택합니다.'),
                onTap: () {
                  Navigator.pop(ctx);
                  _pickAndUploadImages(source: ImageSource.gallery);
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _deletePhoto(int id) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('사진 삭제'),
        content: const Text('이 사진을 보관함에서 영구히 삭제하시겠습니까?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('취소', style: TextStyle(color: Color(0xFF64748B))),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('삭제', style: TextStyle(color: Color(0xFFDC2626), fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    try {
      await _api.deleteMediaAsset(id);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('사진이 삭제되었습니다.')),
        );
      }
      await _loadPhotos();
    } catch (e) {
      if (mounted) {
        String msg = e.toString();
        if (msg.contains('서버에 이 기능이 아직 없습니다') || msg.contains('<!doctype') || msg.contains('<html') || msg.contains('FormatException')) {
          msg = '서버에 이 기능이 아직 없습니다(배포 필요)';
        } else {
          msg = msg.replaceFirst(RegExp(r'^Exception:\s*'), '');
        }
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('삭제 실패: $msg'), backgroundColor: const Color(0xFFDC2626)),
        );
      }
    }
  }

  void _openFullScreenViewer(dynamic photo) {
    final currentUserId = _api.currentUser?.id;
    final isOwner = photo['uploaderId'] == currentUserId;
    final isAdmin = _api.currentUser?.role == 'ACADEMY_ADMIN';
    final canDelete = isOwner || isAdmin;

    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => Scaffold(
          backgroundColor: Colors.black,
          appBar: AppBar(
            backgroundColor: const Color(0x99000000),
            foregroundColor: Colors.white,
            elevation: 0,
            title: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  photo['uploaderName'] ?? '교직원',
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white),
                ),
                Text(
                  _formatDate(photo['createdAt']),
                  style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                ),
              ],
            ),
            actions: [
              if (canDelete)
                IconButton(
                  icon: const Icon(Icons.delete_outline, color: Color(0xFFEF4444)),
                  tooltip: '사진 삭제',
                  onPressed: () async {
                    Navigator.pop(context);
                    await _deletePhoto(photo['id']);
                  },
                ),
            ],
          ),
          body: Center(
            child: InteractiveViewer(
              minScale: 0.8,
              maxScale: 4.0,
              child: photo['url'] != null && photo['url'].toString().isNotEmpty
                  ? Image.network(
                      photo['url'],
                      fit: BoxFit.contain,
                      loadingBuilder: (ctx, child, progress) {
                        if (progress == null) return child;
                        return const Center(child: CircularProgressIndicator(color: Colors.white));
                      },
                      errorBuilder: (ctx, err, stack) => const Center(
                        child: Text('이미지를 불러올 수 없습니다.', style: TextStyle(color: Colors.white)),
                      ),
                    )
                  : const Center(
                      child: Text('이미지 주소가 없습니다.', style: TextStyle(color: Colors.white)),
                    ),
            ),
          ),
        ),
      ),
    );
  }

  String _formatDate(dynamic dateStr) {
    if (dateStr == null) return '';
    try {
      final dt = DateTime.parse(dateStr.toString()).toLocal();
      return '${dt.year}.${dt.month.toString().padLeft(2, '0')}.${dt.day.toString().padLeft(2, '0')} ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return dateStr.toString();
    }
  }

  String _extractDateKey(dynamic dateStr) {
    if (dateStr == null) return '기타';
    try {
      final dt = DateTime.parse(dateStr.toString()).toLocal();
      const weekdays = ['월', '화', '수', '목', '금', '토', '일'];
      final weekday = weekdays[dt.weekday - 1];
      return '${dt.year}년 ${dt.month}월 ${dt.day}일 ($weekday)';
    } catch (_) {
      return '기타';
    }
  }

  Map<String, List<dynamic>> _groupByDate(List<dynamic> photos) {
    final map = <String, List<dynamic>>{};
    for (final p in photos) {
      final key = _extractDateKey(p['createdAt']);
      map.putIfAbsent(key, () => []).add(p);
    }
    return map;
  }

  @override
  Widget build(BuildContext context) {
    final currentUserId = _api.currentUser?.id;
    final grouped = _groupByDate(_photos);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text(
          '사진 보관함 (클라우드)',
          style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
        ),
        backgroundColor: Colors.white,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Color(0xFF64748B)),
            tooltip: '새로고침',
            onPressed: _loadPhotos,
          ),
          IconButton(
            icon: const Icon(Icons.add_a_photo, color: Color(0xFF2563EB)),
            tooltip: '사진 추가',
            onPressed: _isUploading ? null : _showUploadSourceSheet,
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(color: const Color(0xFFF1F5F9), height: 1),
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF2563EB)))
          : _errorMessage != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.error_outline, size: 40, color: Color(0xFFEF4444)),
                      const SizedBox(height: 12),
                      Text(_errorMessage!, style: const TextStyle(color: Color(0xFF64748B))),
                      const SizedBox(height: 12),
                      ElevatedButton(
                        onPressed: _loadPhotos,
                        child: const Text('다시 시도'),
                      ),
                    ],
                  ),
                )
              : _photos.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Container(
                            width: 72,
                            height: 72,
                            decoration: BoxDecoration(
                              color: const Color(0xFFEFF6FF),
                              borderRadius: BorderRadius.circular(36),
                            ),
                            child: const Icon(Icons.cloud_outlined, size: 36, color: Color(0xFF2563EB)),
                          ),
                          const SizedBox(height: 16),
                          const Text(
                            '보관함에 저장된 사진이 없습니다.',
                            style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
                          ),
                          const SizedBox(height: 6),
                          const Text(
                            '현장 사진을 안전하게 클라우드에 보관하고\n관리자 웹과 실시간으로 공유하세요.',
                            textAlign: TextAlign.center,
                            style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                          ),
                          const SizedBox(height: 20),
                          ElevatedButton.icon(
                            onPressed: _showUploadSourceSheet,
                            icon: const Icon(Icons.add_a_photo, size: 18),
                            label: const Text('사진 올리기'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF2563EB),
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                          ),
                        ],
                      ),
                    )
                  : Stack(
                      children: [
                        RefreshIndicator(
                          onRefresh: _loadPhotos,
                          color: const Color(0xFF2563EB),
                          child: ListView.builder(
                            padding: const EdgeInsets.fromLTRB(16, 12, 16, 80),
                            itemCount: grouped.keys.length,
                            itemBuilder: (ctx, idx) {
                              final dateKey = grouped.keys.elementAt(idx);
                              final datePhotos = grouped[dateKey]!;

                              return Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Padding(
                                    padding: const EdgeInsets.symmetric(vertical: 8),
                                    child: Row(
                                      children: [
                                        const Icon(Icons.calendar_today, size: 14, color: Color(0xFF64748B)),
                                        const SizedBox(width: 6),
                                        Text(
                                          dateKey,
                                          style: const TextStyle(
                                            fontSize: 13,
                                            fontWeight: FontWeight.w800,
                                            color: Color(0xFF334155),
                                          ),
                                        ),
                                        const SizedBox(width: 6),
                                        Text(
                                          '(${datePhotos.length})',
                                          style: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8), fontWeight: FontWeight.bold),
                                        ),
                                      ],
                                    ),
                                  ),
                                  GridView.builder(
                                    shrinkWrap: true,
                                    physics: const NeverScrollableScrollPhysics(),
                                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                                      crossAxisCount: 3,
                                      crossAxisSpacing: 8,
                                      mainAxisSpacing: 8,
                                      childAspectRatio: 1,
                                    ),
                                    itemCount: datePhotos.length,
                                    itemBuilder: (context, pIdx) {
                                      final photo = datePhotos[pIdx];
                                      final isMyPhoto = photo['uploaderId'] == currentUserId;

                                      return GestureDetector(
                                        onTap: () => _openFullScreenViewer(photo),
                                        child: ClipRRect(
                                          borderRadius: BorderRadius.circular(10),
                                          child: Stack(
                                            fit: StackFit.expand,
                                            children: [
                                              photo['url'] != null && photo['url'].toString().isNotEmpty
                                                  ? Image.network(
                                                      photo['url'],
                                                      fit: BoxFit.cover,
                                                      errorBuilder: (ctx, err, stack) => Container(
                                                        color: const Color(0xFFE2E8F0),
                                                        child: const Icon(Icons.broken_image, color: Color(0xFF94A3B8)),
                                                      ),
                                                    )
                                                  : Container(
                                                      color: const Color(0xFFE2E8F0),
                                                      child: const Icon(Icons.image, color: Color(0xFF94A3B8)),
                                                    ),
                                              if (isMyPhoto)
                                                Positioned(
                                                  top: 4,
                                                  right: 4,
                                                  child: Container(
                                                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                                                    decoration: BoxDecoration(
                                                      color: const Color(0xD92563EB),
                                                      borderRadius: BorderRadius.circular(4),
                                                    ),
                                                    child: const Text(
                                                      '내 사진',
                                                      style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold),
                                                    ),
                                                  ),
                                                ),
                                            ],
                                          ),
                                        ),
                                      );
                                    },
                                  ),
                                  const SizedBox(height: 12),
                                ],
                              );
                            },
                          ),
                        ),
                        if (_isUploading)
                          Container(
                            color: const Color(0x4D000000),
                            child: const Center(
                              child: Card(
                                child: Padding(
                                  padding: EdgeInsets.symmetric(horizontal: 24, vertical: 20),
                                  child: Column(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      CircularProgressIndicator(color: Color(0xFF2563EB)),
                                      SizedBox(height: 14),
                                      Text('클라우드에 사진 업로드 중...', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _isUploading ? null : _showUploadSourceSheet,
        backgroundColor: const Color(0xFF2563EB),
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add_a_photo),
        label: const Text('사진 올리기', style: TextStyle(fontWeight: FontWeight.bold)),
      ),
    );
  }
}
