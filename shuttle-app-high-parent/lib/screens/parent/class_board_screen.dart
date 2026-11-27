import '../../widgets/load_error_view.dart';
import 'package:flutter/material.dart';
import '../../config.dart';
import '../../services/api_service.dart';

class ClassBoardScreen extends StatefulWidget {
  final String? childClassName;
  final bool isEmbedded;

  const ClassBoardScreen({super.key, this.childClassName, this.isEmbedded = false});

  @override
  State<ClassBoardScreen> createState() => _ClassBoardScreenState();
}

class _ClassBoardScreenState extends State<ClassBoardScreen> {
  List<Map<String, dynamic>> _posts = [];
  bool _isLoading = true;
  String? _loadError; // 불러오기 실패 이유 (null 이면 정상)

  @override
  void initState() {
    super.initState();
    _loadPosts();
  }

  Future<void> _loadPosts() async {
    final user = ApiService().currentUser;
    if (user == null) {
      if (mounted) setState(() => _isLoading = false);
      return;
    }

    try {
      final list = await ApiService().getClassBoardPosts(user.email);
      if (mounted) {
        setState(() {
          _posts = list;
          _isLoading = false;
          _loadError = null;
        });
      }
    } catch (e) {
      // 네트워크/서버 오류를 '비어 있음'으로 보여주지 않고 이유와 다시 시도를 알려준다
      if (mounted) {
        setState(() {
          _loadError = friendlyError(e);
          _isLoading = false;
        });
      }
    }
  }

  String _resolveImageUrl(String? url, {bool thumbnail = false}) {
    if (url == null || url.trim().isEmpty) return '';
    String resolved = url.trim();
    if (!resolved.startsWith('http://') && !resolved.startsWith('https://')) {
      final host = AppConfig.apiHost.endsWith('/')
          ? AppConfig.apiHost.substring(0, AppConfig.apiHost.length - 1)
          : AppConfig.apiHost;
      resolved = resolved.startsWith('/') ? '$host$resolved' : '$host/$resolved';
    }
    if (thumbnail && resolved.contains('/uploads/board/') && !resolved.contains('/uploads/board/thumb_')) {
      resolved = resolved.replaceFirst('/uploads/board/', '/uploads/board/thumb_');
    }
    return resolved;
  }

  String _formatDate(dynamic dateVal) {
    if (dateVal == null) return '';
    try {
      final dt = DateTime.parse(dateVal.toString());
      return '${dt.year}.${dt.month.toString().padLeft(2, '0')}.${dt.day.toString().padLeft(2, '0')} ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return dateVal.toString();
    }
  }

  void _openDetail(Map<String, dynamic> post) {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => ClassBoardDetailScreen(post: post)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final classLabel = widget.childClassName != null && widget.childClassName!.isNotEmpty
        ? '${widget.childClassName} 알림장'
        : '우리 반 알림장';

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        automaticallyImplyLeading: !widget.isEmbedded,
        title: Text(
          classLabel,
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: Color(0xFF0F172A)),
        ),
        backgroundColor: Colors.white,
        elevation: 0,
        centerTitle: false,
        iconTheme: const IconThemeData(color: Color(0xFF0F172A)),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(color: const Color(0xFFF1F5F9), height: 1),
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF2563EB)))
          : _loadError != null
              ? LoadErrorView(title: '알림장을 불러오지 못했습니다.', message: _loadError!, onRetry: _loadPosts)
              : RefreshIndicator(
              onRefresh: _loadPosts,
              child: _posts.isEmpty
                  ? Center(
                      child: SingleChildScrollView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Container(
                              padding: const EdgeInsets.all(22),
                              decoration: const BoxDecoration(
                                color: Color(0xFFEFF6FF),
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(
                                Icons.article_outlined,
                                size: 48,
                                color: Color(0xFF2563EB),
                              ),
                            ),
                            const SizedBox(height: 18),
                            const Text(
                              '등록된 알림장이 없습니다',
                              style: TextStyle(
                                fontSize: 17,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF334155),
                              ),
                            ),
                            const SizedBox(height: 6),
                            const Text(
                              '담임선생님이 알림장을 등록하면 여기에 표시됩니다.',
                              style: TextStyle(fontSize: 13, color: Color(0xFF94A3B8)),
                            ),
                          ],
                        ),
                      ),
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                      itemCount: _posts.length,
                      separatorBuilder: (context, index) => const SizedBox(height: 12),
                      itemBuilder: (context, index) {
                        final post = _posts[index];
                        final title = post['title']?.toString() ?? '제목 없음';
                        final content = post['content']?.toString() ?? '';
                        final author = post['authorName']?.toString() ?? '선생님';
                        final targetClass = post['targetClass']?.toString() ?? post['className']?.toString();
                        final isClassOnly = targetClass != null && targetClass.isNotEmpty;
                        final dateStr = _formatDate(post['createdAt']);

                        final List<dynamic> images = post['images'] is List ? post['images'] : [];
                        final singleImage = post['imageUrl']?.toString();
                        final hasImage = (singleImage != null && singleImage.isNotEmpty) || images.isNotEmpty;
                        final thumbUrl = (singleImage != null && singleImage.isNotEmpty)
                            ? singleImage
                            : (images.isNotEmpty ? images.first.toString() : null);

                        return Material(
                          color: Colors.transparent,
                          child: InkWell(
                            onTap: () => _openDetail(post),
                            borderRadius: BorderRadius.circular(16),
                            child: Container(
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(color: const Color(0xFFE2E8F0)),
                                boxShadow: [
                                  BoxShadow(
                                    color: const Color(0xFF0F172A).withValues(alpha: 0.03),
                                    blurRadius: 6,
                                    offset: const Offset(0, 2),
                                  ),
                                ],
                              ),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          children: [
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                                              decoration: BoxDecoration(
                                                color: isClassOnly ? const Color(0xFFDBEAFE) : const Color(0xFFF1F5F9),
                                                borderRadius: BorderRadius.circular(6),
                                              ),
                                              child: Text(
                                                isClassOnly ? targetClass : '전체 공지',
                                                style: TextStyle(
                                                  color: isClassOnly ? const Color(0xFF1D4ED8) : const Color(0xFF475569),
                                                  fontSize: 11,
                                                  fontWeight: FontWeight.bold,
                                                ),
                                              ),
                                            ),
                                            const SizedBox(width: 8),
                                            Text(
                                              author,
                                              style: const TextStyle(
                                                fontSize: 12,
                                                color: Color(0xFF64748B),
                                                fontWeight: FontWeight.w600,
                                              ),
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 8),
                                        Text(
                                          title,
                                          style: const TextStyle(
                                            fontSize: 15,
                                            fontWeight: FontWeight.w800,
                                            color: Color(0xFF0F172A),
                                          ),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          content,
                                          style: const TextStyle(
                                            fontSize: 13,
                                            height: 1.4,
                                            color: Color(0xFF475569),
                                          ),
                                          maxLines: 2,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                        const SizedBox(height: 8),
                                        Text(
                                          dateStr,
                                          style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                                        ),
                                      ],
                                    ),
                                  ),
                                  if (hasImage && thumbUrl != null) ...[
                                    const SizedBox(width: 12),
                                    ClipRRect(
                                      borderRadius: BorderRadius.circular(10),
                                      child: Image.network(
                                        _resolveImageUrl(thumbUrl, thumbnail: true),
                                        width: 72,
                                        height: 72,
                                        fit: BoxFit.cover,
                                        cacheWidth: 200,
                                        cacheHeight: 200,
                                        filterQuality: FilterQuality.low,
                                        errorBuilder: (ctx, err, stack) => Container(
                                          width: 72,
                                          height: 72,
                                          color: const Color(0xFFF1F5F9),
                                          child: const Icon(Icons.broken_image_outlined, color: Color(0xFF94A3B8)),
                                        ),
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          ),
                        );
                      },
                    ),
            ),
    );
  }
}

class ClassBoardDetailScreen extends StatefulWidget {
  final Map<String, dynamic> post;

  const ClassBoardDetailScreen({super.key, required this.post});

  @override
  State<ClassBoardDetailScreen> createState() => _ClassBoardDetailScreenState();
}

class _ClassBoardDetailScreenState extends State<ClassBoardDetailScreen> {
  final TextEditingController _commentController = TextEditingController();
  final List<Map<String, dynamic>> _comments = [];
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    if (widget.post['comments'] is List) {
      for (final c in (widget.post['comments'] as List)) {
        if (c is Map) {
          _comments.add(Map<String, dynamic>.from(c));
        }
      }
    }
  }

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  Future<void> _submitComment() async {
    final text = _commentController.text.trim();
    if (text.isEmpty) return;

    final postId = widget.post['id'] is int
        ? widget.post['id']
        : int.tryParse(widget.post['id']?.toString() ?? '0') ?? 0;
    if (postId == 0) return;

    final user = ApiService().currentUser;
    final authorName = user?.name ?? '학부모';

    setState(() => _isSubmitting = true);
    final res = await ApiService().addPostComment(
      postId,
      content: text,
      authorName: authorName,
      authorRole: 'PARENT',
    );
    if (!mounted) return;
    setState(() => _isSubmitting = false);

    if (res['success'] == true) {
      _commentController.clear();
      final newComment = res['data'] is Map
          ? Map<String, dynamic>.from(res['data'])
          : {
              'id': DateTime.now().millisecondsSinceEpoch,
              'content': text,
              'authorName': authorName,
              'authorRole': 'PARENT',
              'createdAt': DateTime.now().toIso8601String(),
            };
      setState(() {
        _comments.add(newComment);
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('댓글이 등록되었습니다.'),
          duration: Duration(seconds: 1),
          backgroundColor: Color(0xFF10B981),
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(res['message'] ?? '댓글 작성에 실패했습니다.'),
          backgroundColor: const Color(0xFFEF4444),
        ),
      );
    }
  }

  String _resolveImageUrl(String? url, {bool thumbnail = false}) {
    if (url == null || url.trim().isEmpty) return '';
    String resolved = url.trim();
    if (!resolved.startsWith('http://') && !resolved.startsWith('https://')) {
      final host = AppConfig.apiHost.endsWith('/')
          ? AppConfig.apiHost.substring(0, AppConfig.apiHost.length - 1)
          : AppConfig.apiHost;
      resolved = resolved.startsWith('/') ? '$host$resolved' : '$host/$resolved';
    }
    if (thumbnail && resolved.contains('/uploads/board/') && !resolved.contains('/uploads/board/thumb_')) {
      resolved = resolved.replaceFirst('/uploads/board/', '/uploads/board/thumb_');
    }
    return resolved;
  }

  String _formatDate(dynamic dateVal) {
    if (dateVal == null) return '';
    try {
      final dt = DateTime.parse(dateVal.toString());
      return '${dt.year}년 ${dt.month}월 ${dt.day}일 ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return dateVal.toString();
    }
  }

  void _openImageZoom(BuildContext context, String imageUrl) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => Scaffold(
          backgroundColor: Colors.black,
          appBar: AppBar(
            backgroundColor: Colors.black,
            iconTheme: const IconThemeData(color: Colors.white),
            elevation: 0,
            title: const Text('사진 확대', style: TextStyle(color: Colors.white, fontSize: 16)),
          ),
          body: Center(
            child: InteractiveViewer(
              panEnabled: true,
              minScale: 0.8,
              maxScale: 4.0,
              child: Image.network(
                _resolveImageUrl(imageUrl),
                fit: BoxFit.contain,
                errorBuilder: (ctx, err, stack) => const Center(
                  child: Text('이미지를 불러올 수 없습니다.', style: TextStyle(color: Colors.white)),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final post = widget.post;
    final title = post['title']?.toString() ?? '제목 없음';
    final content = post['content']?.toString() ?? '';
    final author = post['authorName']?.toString() ?? '선생님';
    final targetClass = post['targetClass']?.toString() ?? post['className']?.toString();
    final isClassOnly = targetClass != null && targetClass.isNotEmpty;
    final dateStr = _formatDate(post['createdAt']);

    final List<String> allImages = [];
    if (post['imageUrl'] != null && post['imageUrl'].toString().isNotEmpty) {
      allImages.add(post['imageUrl'].toString());
    }
    if (post['images'] is List) {
      for (final img in (post['images'] as List)) {
        final url = img?.toString();
        if (url != null && url.isNotEmpty && !allImages.contains(url)) {
          allImages.add(url);
        }
      }
    }

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: const Text(
          '알림장 상세',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: Color(0xFF0F172A)),
        ),
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: Color(0xFF0F172A)),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(color: const Color(0xFFF1F5F9), height: 1),
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: isClassOnly ? const Color(0xFFDBEAFE) : const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          isClassOnly ? targetClass : '전체 공지',
                          style: TextStyle(
                            color: isClassOnly ? const Color(0xFF1D4ED8) : const Color(0xFF475569),
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      const Spacer(),
                      Text(
                        dateStr,
                        style: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF0F172A),
                      height: 1.3,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      const Icon(Icons.account_circle, size: 20, color: Color(0xFF64748B)),
                      const SizedBox(width: 6),
                      Text(
                        author,
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF475569)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  const Divider(color: Color(0xFFF1F5F9)),
                  const SizedBox(height: 16),
                  Text(
                    content,
                    style: const TextStyle(
                      fontSize: 15,
                      height: 1.7,
                      color: Color(0xFF334155),
                    ),
                  ),
                  if (allImages.isNotEmpty) ...[
                    const SizedBox(height: 24),
                    const Text(
                      '첨부 사진 (터치하여 확대)',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF64748B)),
                    ),
                    const SizedBox(height: 10),
                    ListView.separated(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: allImages.length,
                      separatorBuilder: (ctx, idx) => const SizedBox(height: 12),
                      itemBuilder: (ctx, idx) {
                        final imgUrl = allImages[idx];
                        return GestureDetector(
                          onTap: () => _openImageZoom(context, imgUrl),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(14),
                            child: Stack(
                              alignment: Alignment.bottomRight,
                              children: [
                                Image.network(
                                  _resolveImageUrl(imgUrl, thumbnail: true),
                                  width: double.infinity,
                                  fit: BoxFit.cover,
                                  cacheWidth: 800,
                                  filterQuality: FilterQuality.low,
                                  errorBuilder: (c, e, s) => Container(
                                    height: 180,
                                    color: const Color(0xFFF1F5F9),
                                    child: const Center(
                                      child: Icon(Icons.broken_image_outlined, color: Color(0xFF94A3B8), size: 36),
                                    ),
                                  ),
                                ),
                                Container(
                                  margin: const EdgeInsets.all(10),
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                  decoration: BoxDecoration(
                                    color: Colors.black.withValues(alpha: 0.6),
                                    borderRadius: BorderRadius.circular(20),
                                  ),
                                  child: const Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(Icons.zoom_in, color: Colors.white, size: 16),
                                      SizedBox(width: 4),
                                      Text(
                                        '확대보기',
                                        style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                  ],
                  const SizedBox(height: 24),
                  const Divider(color: Color(0xFFE2E8F0)),
                  const SizedBox(height: 16),

                  // 댓글 섹션
                  Row(
                    children: [
                      const Icon(Icons.chat_bubble_outline, size: 18, color: Color(0xFF2563EB)),
                      const SizedBox(width: 6),
                      Text(
                        '댓글 ${_comments.length}',
                        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  if (_comments.isEmpty)
                    Container(
                      padding: const EdgeInsets.symmetric(vertical: 20),
                      alignment: Alignment.center,
                      child: const Text(
                        '작성된 댓글이 없습니다. 첫 댓글을 남겨보세요.',
                        style: TextStyle(fontSize: 13, color: Color(0xFF94A3B8)),
                      ),
                    )
                  else
                    ListView.separated(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: _comments.length,
                      separatorBuilder: (ctx, idx) => const Divider(height: 16, color: Color(0xFFF1F5F9)),
                      itemBuilder: (ctx, idx) {
                        final c = _comments[idx];
                        final cAuthor = c['authorName']?.toString() ?? '익명';
                        final cRole = c['authorRole']?.toString() ?? 'USER';
                        final cRoleKr = cRole == 'ADMIN'
                            ? '원장님'
                            : (cRole == 'TEACHER' || cRole == 'HOMEROOM_TEACHER' ? '선생님' : '학부모');
                        final cTime = _formatDate(c['createdAt']);
                        final cContent = c['content']?.toString() ?? '';

                        return Container(
                          padding: const EdgeInsets.symmetric(vertical: 6),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Text(
                                    cAuthor,
                                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
                                  ),
                                  const SizedBox(width: 6),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: cRole == 'ADMIN'
                                          ? const Color(0xFFFEF3C7)
                                          : (cRole == 'PARENT' ? const Color(0xFFEFF6FF) : const Color(0xFFECFDF5)),
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                    child: Text(
                                      cRoleKr,
                                      style: TextStyle(
                                        fontSize: 10,
                                        fontWeight: FontWeight.bold,
                                        color: cRole == 'ADMIN'
                                            ? const Color(0xFFD97706)
                                            : (cRole == 'PARENT' ? const Color(0xFF2563EB) : const Color(0xFF059669)),
                                      ),
                                    ),
                                  ),
                                  const Spacer(),
                                  Text(
                                    cTime,
                                    style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 6),
                              Text(
                                cContent,
                                style: const TextStyle(fontSize: 14, color: Color(0xFF334155), height: 1.4),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
                  const SizedBox(height: 20),
                ],
              ),
            ),
          ),

          // 하단 댓글 입력창
          Container(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 14),
            decoration: const BoxDecoration(
              color: Colors.white,
              border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
            ),
            child: SafeArea(
              top: false,
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _commentController,
                      decoration: InputDecoration(
                        hintText: '댓글을 입력하세요...',
                        hintStyle: const TextStyle(fontSize: 14, color: Color(0xFF94A3B8)),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        filled: true,
                        fillColor: const Color(0xFFF8FAFC),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(20),
                          borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(20),
                          borderSide: const BorderSide(color: Color(0xFF2563EB), width: 1.5),
                        ),
                      ),
                      minLines: 1,
                      maxLines: 3,
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton(
                    onPressed: _isSubmitting ? null : _submitComment,
                    icon: _isSubmitting
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.send_rounded, color: Color(0xFF2563EB)),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
