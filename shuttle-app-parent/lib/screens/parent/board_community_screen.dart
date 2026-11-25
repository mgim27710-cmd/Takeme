import 'package:flutter/material.dart';
import '../../services/api_service.dart';

/// 학부모용 원 게시판 & 커뮤니티 전용 화면
/// 원 전체 공지사항, 원아 활동 앨범, 학부모 자유 커뮤니티 및 댓글/좋아요 소통
class BoardCommunityScreen extends StatefulWidget {
  final bool isEmbedded;

  const BoardCommunityScreen({super.key, this.isEmbedded = false});

  @override
  State<BoardCommunityScreen> createState() => _BoardCommunityScreenState();
}

class _BoardCommunityScreenState extends State<BoardCommunityScreen> {
  List<Map<String, dynamic>> _posts = [];
  bool _isLoading = true;
  String _searchQuery = '';
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadPosts();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadPosts() async {
    final user = ApiService().currentUser;
    if (user == null) {
      if (mounted) setState(() => _isLoading = false);
      return;
    }

    try {
      final posts = await ApiService().getBoardPosts(
        academyId: user.academyId,
        search: _searchQuery.isNotEmpty ? _searchQuery : null,
      );
      if (mounted) {
        setState(() {
          _posts = posts;
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  /// 글을 열지 않고 바로 좋아요. 화면에 먼저 반영하고, 서버 요청이 실패하면 되돌린다.
  Future<void> _quickLike(Map<String, dynamic> post) async {
    final user = ApiService().currentUser;
    final postId = int.tryParse('${post['id']}') ?? 0;
    if (user == null || postId == 0) return;
    final myId = user.id.toString();
    final before = List<String>.from((post['likedUserIds'] as List? ?? []).map((e) => e.toString()));
    final beforeCount = int.tryParse('${post['likeCount']}') ?? 0;
    final wasLiked = before.contains(myId);
    setState(() {
      final now = List<String>.from(before);
      if (wasLiked) {
        now.remove(myId);
      } else {
        now.add(myId);
      }
      post['likedUserIds'] = now;
      post['likeCount'] = wasLiked ? (beforeCount > 0 ? beforeCount - 1 : 0) : beforeCount + 1;
    });
    final res = await ApiService().togglePostLike(postId, myId);
    if (res['success'] != true && mounted) {
      setState(() {
        post['likedUserIds'] = before;
        post['likeCount'] = beforeCount;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('좋아요에 실패했습니다. 잠시 뒤 다시 눌러 주세요.'), backgroundColor: Color(0xFFEF4444)),
      );
    }
  }

  /// 글을 열지 않고 하단에서 올라오는 입력창으로 바로 댓글 쓰기
  Future<void> _quickComment(Map<String, dynamic> post) async {
    final postId = int.tryParse('${post['id']}') ?? 0;
    if (postId == 0) return;
    final posted = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(18))),
      builder: (ctx) => _QuickCommentSheet(postId: postId, postTitle: post['title']?.toString() ?? ''),
    );
    if (posted != null && mounted) {
      setState(() {
        final comments = List<dynamic>.from(post['comments'] as List? ?? []);
        comments.add(posted);
        post['comments'] = comments;
        post['commentCount'] = comments.length;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('댓글이 등록되었습니다.'), duration: Duration(seconds: 2), backgroundColor: Color(0xFF2563EB)),
      );
    }
  }
  void _openDetail(Map<String, dynamic> post) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => BoardDetailScreen(post: post),
      ),
    ).then((_) => _loadPosts());
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        automaticallyImplyLeading: !widget.isEmbedded,
        elevation: 0,
        backgroundColor: Colors.white,
        centerTitle: false,
        // 알림장 화면과 같은 모양의 제목 배지
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: const Color(0xFFEFF6FF),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: const Color(0xFFBFDBFE)),
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.dashboard_outlined, color: Color(0xFF2563EB), size: 16),
                  SizedBox(width: 6),
                  Text(
                    '우리 반 게시판 & 소식',
                    style: TextStyle(color: Color(0xFF1E40AF), fontSize: 14, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: Color(0xFF475569)),
            tooltip: '새로고침',
            onPressed: () {
              setState(() => _isLoading = true);
              _loadPosts();
            },
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(color: const Color(0xFFF1F5F9), height: 1),
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF2563EB)))
          : Column(
              children: [
                // 게시판 안내 (알림장 화면의 안내와 같은 모양)
                Container(
                  width: double.infinity,
                  margin: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: const Row(
                    children: [
                      Icon(Icons.forum_rounded, color: Color(0xFF2563EB), size: 22),
                      SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '우리 반 게시판 & 소식',
                              style: TextStyle(color: Color(0xFF1E293B), fontSize: 14, fontWeight: FontWeight.bold),
                            ),
                            SizedBox(height: 3),
                            Text(
                              '유치원 공지, 활동 사진, 우리 반 소식을 볼 수 있어요. 글에 좋아요와 댓글을 남길 수 있어요.',
                              style: TextStyle(color: Color(0xFF64748B), fontSize: 12, height: 1.3),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                // 검색바
                Container(
                  color: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  child: Column(
                    children: [
                      // 검색창
                      Container(
                        height: 40,
                        decoration: BoxDecoration(
                          color: const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: TextField(
                          controller: _searchController,
                          textInputAction: TextInputAction.search,
                          onSubmitted: (val) {
                            setState(() => _searchQuery = val.trim());
                            _loadPosts();
                          },
                          decoration: InputDecoration(
                            hintText: '공지사항, 활동 앨범, 작성자 검색',
                            hintStyle: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                            prefixIcon: const Icon(Icons.search_rounded, size: 18, color: Color(0xFF64748B)),
                            suffixIcon: _searchQuery.isNotEmpty
                                ? IconButton(
                                    icon: const Icon(Icons.clear_rounded, size: 16, color: Color(0xFF94A3B8)),
                                    onPressed: () {
                                      _searchController.clear();
                                      setState(() => _searchQuery = '');
                                      _loadPosts();
                                    },
                                  )
                                : null,
                            border: InputBorder.none,
                            contentPadding: const EdgeInsets.symmetric(vertical: 10),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

                const Divider(height: 1, color: Color(0xFFE2E8F0)),

                // 게시글 목록
                Expanded(
                  child: RefreshIndicator(
                    onRefresh: _loadPosts,
                    color: const Color(0xFF2563EB),
                    child: _posts.isEmpty
                        ? Center(
                            child: SingleChildScrollView(
                              physics: const AlwaysScrollableScrollPhysics(),
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Container(
                                    padding: const EdgeInsets.all(20),
                                    decoration: const BoxDecoration(
                                      color: Color(0xFFEFF6FF),
                                      shape: BoxShape.circle,
                                    ),
                                    child: const Icon(Icons.forum_outlined, size: 44, color: Color(0xFF2563EB)),
                                  ),
                                  const SizedBox(height: 14),
                                  const Text(
                                    '등록된 게시글이 없습니다',
                                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF334155)),
                                  ),
                                  const SizedBox(height: 4),
                                  const Text(
                                    '유치원에서 올린 글이 여기에 표시됩니다.',
                                    style: TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                                  ),
                                ],
                              ),
                            ),
                          )
                        : ListView.separated(
                            padding: const EdgeInsets.all(16),
                            itemCount: _posts.length,
                            separatorBuilder: (_, __) => const SizedBox(height: 12),
                            itemBuilder: (ctx, idx) => _buildPostCard(_posts[idx]),
                          ),
                  ),
                ),
              ],
            ),
    );
  }

  Widget _buildPostCard(Map<String, dynamic> post) {
    final title = post['title']?.toString() ?? '제목 없음';
    final content = post['content']?.toString() ?? '';
    final author = post['authorName']?.toString() ?? '작성자';
    final role = post['authorRole']?.toString() ?? 'STAFF';
    final dateStr = post['createdAt']?.toString() ?? '';
    final likeCount = post['likeCount'] as int? ?? 0;
    final commentCount = post['commentCount'] as int? ?? (post['comments'] as List?)?.length ?? 0;

    final List<dynamic> images = post['images'] is List ? post['images'] : [];
    final singleImage = post['imageUrl']?.toString();
    final hasImage = (singleImage != null && singleImage.isNotEmpty) || images.isNotEmpty;
    final String? rawThumb = (singleImage != null && singleImage.isNotEmpty)
        ? singleImage
        : (images.isNotEmpty ? images.first.toString() : null);
    final thumbUrl = (rawThumb != null && rawThumb.contains('/uploads/board/') && !rawThumb.contains('/uploads/board/thumb_'))
        ? rawThumb.replaceFirst('/uploads/board/', '/uploads/board/thumb_')
        : rawThumb;

    final isNotice = role == 'ADMIN' || role == 'ACADEMY_ADMIN' || title.contains('공지');
    final myId = ApiService().currentUser?.id.toString();
    final liked = myId != null && (post['likedUserIds'] as List? ?? []).map((e) => e.toString()).contains(myId);

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () => _openDetail(post),
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 상단 작성자 정보 & 뱃지
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                      decoration: BoxDecoration(
                        color: isNotice ? const Color(0xFFFEF2F2) : const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        isNotice ? '📢 원 공지' : (role == 'PARENT' ? '학부모' : '교직원'),
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: isNotice ? const Color(0xFFDC2626) : const Color(0xFF475569),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      author,
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF475569)),
                    ),
                    const Spacer(),
                    Text(
                      dateStr.length >= 10 ? dateStr.substring(0, 10) : dateStr,
                      style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                    ),
                  ],
                ),

                const SizedBox(height: 10),

                // 제목
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF0F172A),
                    height: 1.3,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),

                const SizedBox(height: 6),

                // 본문 미리보기 및 썸네일
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Text(
                        content,
                        style: const TextStyle(fontSize: 13, height: 1.4, color: Color(0xFF64748B)),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    if (hasImage && thumbUrl != null) ...[
                      const SizedBox(width: 12),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(10),
                        child: Image.network(
                          thumbUrl,
                          width: 68,
                          height: 68,
                          fit: BoxFit.cover,
                          cacheWidth: 200,
                          cacheHeight: 200,
                          filterQuality: FilterQuality.low,
                          errorBuilder: (_, __, ___) => Container(
                            width: 68,
                            height: 68,
                            color: const Color(0xFFF1F5F9),
                            child: const Icon(Icons.broken_image_outlined, color: Color(0xFF94A3B8)),
                          ),
                        ),
                      ),
                    ],
                  ],
                ),

                const SizedBox(height: 12),
                const Divider(height: 1, color: Color(0xFFF1F5F9)),
                const SizedBox(height: 10),

                // 하단 인터랙션: 글을 열지 않고 바로 좋아요·댓글
                Row(
                  children: [
                    InkWell(
                      onTap: () => _quickLike(post),
                      borderRadius: BorderRadius.circular(16),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                        child: Row(
                          children: [
                            Icon(
                              liked ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                              size: 19,
                              color: liked ? const Color(0xFFEF4444) : const Color(0xFF64748B),
                            ),
                            const SizedBox(width: 5),
                            Text(
                              '$likeCount',
                              style: TextStyle(
                                fontSize: 12,
                                color: liked ? const Color(0xFFDC2626) : const Color(0xFF64748B),
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(width: 6),
                    InkWell(
                      onTap: () => _quickComment(post),
                      borderRadius: BorderRadius.circular(16),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                        child: Row(
                          children: [
                            const Icon(Icons.mode_comment_outlined, size: 18, color: Color(0xFF3B82F6)),
                            const SizedBox(width: 5),
                            Text(
                              '댓글 $commentCount',
                              style: const TextStyle(fontSize: 12, color: Color(0xFF64748B), fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const Spacer(),
                    const Text('자세히 보기 >', style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8))),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// 게시글 상세 및 댓글/좋아요 화면
class BoardDetailScreen extends StatefulWidget {
  final Map<String, dynamic> post;

  const BoardDetailScreen({super.key, required this.post});

  @override
  State<BoardDetailScreen> createState() => _BoardDetailScreenState();
}

class _BoardDetailScreenState extends State<BoardDetailScreen> {
  final TextEditingController _commentController = TextEditingController();
  late int _likeCount;
  bool _isLiked = false;
  List<dynamic> _comments = [];
  bool _isSubmittingComment = false;

  @override
  void initState() {
    super.initState();
    _likeCount = int.tryParse(widget.post['likeCount']?.toString() ?? '') ?? 0;
    _comments = List.from(widget.post['comments'] as List? ?? []);
    final user = ApiService().currentUser;
    final likedUsers = widget.post['likedUserIds'] as List? ?? [];
    if (user != null && likedUsers.contains(user.id.toString())) {
      _isLiked = true;
    }
    final pid = int.tryParse(widget.post['id']?.toString() ?? '');
    if (pid != null) ApiService().markPostRead(pid).ignore(); // 열면 읽음 기록 (담임교사가 누가 읽었는지 볼 수 있다)
    _refreshPost();
  }

  Future<void> _refreshPost() async {
    final postId = int.tryParse(widget.post['id']?.toString() ?? '') ?? 0;
    if (postId == 0) return;
    final updated = await ApiService().getBoardPostById(postId);
    if (updated != null && mounted) {
      setState(() {
        _comments = List.from(updated['comments'] as List? ?? []);
        _likeCount = int.tryParse(updated['likeCount']?.toString() ?? '') ?? _likeCount;
      });
    }
  }

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  Future<void> _toggleLike() async {
    final user = ApiService().currentUser;
    if (user == null) return;

    final postId = int.tryParse(widget.post['id']?.toString() ?? '') ?? 0;
    if (postId == 0) return;
    setState(() {
      _isLiked = !_isLiked;
      _likeCount += _isLiked ? 1 : -1;
    });

    await ApiService().togglePostLike(postId, user.id.toString());
  }

  Future<void> _addComment() async {
    final text = _commentController.text.trim();
    if (text.isEmpty || _isSubmittingComment) return;

    final user = ApiService().currentUser;
    final authorName = (user?.name != null && user!.name.isNotEmpty) ? user.name : '학부모';

    setState(() => _isSubmittingComment = true);
    final postId = int.tryParse(widget.post['id']?.toString() ?? '') ?? 0;
    if (postId == 0) {
      setState(() => _isSubmittingComment = false);
      return;
    }

    final res = await ApiService().addPostComment(
      postId,
      content: text,
      authorName: authorName,
      authorRole: 'PARENT',
    );

    if (mounted) {
      setState(() => _isSubmittingComment = false);
      if (res['success'] == true) {
        _commentController.clear();
        FocusScope.of(context).unfocus();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('댓글이 등록되었습니다.'),
            duration: Duration(seconds: 2),
            backgroundColor: Color(0xFF2563EB),
          ),
        );
        await _refreshPost();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(res['message']?.toString() ?? '댓글 등록에 실패했습니다.'),
            backgroundColor: const Color(0xFFEF4444),
          ),
        );
      }
    }
  }

  Future<void> _deleteComment(int commentId) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('댓글 삭제', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        content: const Text('댓글을 삭제하시겠습니까?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('취소', style: TextStyle(color: Color(0xFF64748B))),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('삭제', style: TextStyle(color: Color(0xFFEF4444), fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
    if (confirm != true) return;

    final postId = int.tryParse(widget.post['id']?.toString() ?? '') ?? 0;
    final res = await ApiService().deleteBoardComment(postId, commentId);
    if (res['success'] == true && mounted) {
      await _refreshPost();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('댓글이 삭제되었습니다.')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final title = widget.post['title']?.toString() ?? '';
    final content = widget.post['content']?.toString() ?? '';
    final author = widget.post['authorName']?.toString() ?? '';
    final dateStr = widget.post['createdAt']?.toString() ?? '';

    final List<String> allImages = [];
    if (widget.post['imageUrl'] != null && widget.post['imageUrl'].toString().isNotEmpty) {
      allImages.add(widget.post['imageUrl'].toString());
    }
    if (widget.post['images'] is List) {
      for (final img in (widget.post['images'] as List)) {
        final url = img?.toString();
        if (url != null && url.isNotEmpty && !allImages.contains(url)) {
          allImages.add(url);
        }
      }
    }

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: const Text('게시글 상세', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: Color(0xFF0F172A))),
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
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(author, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Color(0xFF334155))),
                      const Spacer(),
                      Text(dateStr.length >= 10 ? dateStr.substring(0, 10) : dateStr, style: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8))),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text(title, style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w900, color: Color(0xFF0F172A), height: 1.3)),
                  const SizedBox(height: 14),
                  const Divider(color: Color(0xFFF1F5F9)),
                  const SizedBox(height: 14),
                  Text(content, style: const TextStyle(fontSize: 15, height: 1.7, color: Color(0xFF334155))),
                  if (allImages.isNotEmpty) ...[
                    const SizedBox(height: 20),
                    ...allImages.map((img) => Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(12),
                            child: Image.network(
                              img,
                              width: double.infinity,
                              fit: BoxFit.cover,
                              cacheWidth: 800,
                              filterQuality: FilterQuality.low,
                            ),
                          ),
                        )),
                  ],
                  const SizedBox(height: 20),
                  // 좋아요 버튼 바
                  Row(
                    children: [
                      InkWell(
                        onTap: _toggleLike,
                        borderRadius: BorderRadius.circular(20),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                          decoration: BoxDecoration(
                            color: _isLiked ? const Color(0xFFFEE2E2) : const Color(0xFFF1F5F9),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Row(
                            children: [
                              Icon(_isLiked ? Icons.favorite_rounded : Icons.favorite_border_rounded, size: 18, color: _isLiked ? const Color(0xFFEF4444) : const Color(0xFF64748B)),
                              const SizedBox(width: 6),
                              Text('$_likeCount', style: TextStyle(color: _isLiked ? const Color(0xFFDC2626) : const Color(0xFF475569), fontWeight: FontWeight.bold, fontSize: 13)),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Row(
                        children: [
                          const Icon(Icons.mode_comment_outlined, size: 18, color: Color(0xFF64748B)),
                          const SizedBox(width: 6),
                          Text('${_comments.length}개의 댓글', style: const TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.bold, fontSize: 13)),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                  const Divider(color: Color(0xFFF1F5F9)),
                  const SizedBox(height: 14),
                  const Text('댓글 목록', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
                  const SizedBox(height: 10),
                  if (_comments.isEmpty)
                    Container(
                      padding: const EdgeInsets.symmetric(vertical: 20),
                      alignment: Alignment.center,
                      child: const Text('첫 댓글을 남겨보세요!', style: TextStyle(fontSize: 13, color: Color(0xFF94A3B8))),
                    )
                  else
                    ..._comments.map((c) {
                      final author = c['authorName']?.toString() ?? '익명';
                      final role = c['authorRole']?.toString() ?? 'PARENT';
                      final content = c['content']?.toString() ?? '';
                      final dateStr = c['createdAt']?.toString() ?? '';
                      final commentId = int.tryParse(c['id']?.toString() ?? '') ?? 0;
                      final currentUserName = ApiService().currentUser?.name;
                      final isMyComment = (currentUserName != null && currentUserName.isNotEmpty && author == currentUserName) ||
                          (role == 'PARENT' && currentUserName != null && author.contains(currentUserName));

                      return Container(
                        margin: const EdgeInsets.only(bottom: 10),
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: const Color(0xFFF1F5F9)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Text(author, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Color(0xFF334155))),
                                const SizedBox(width: 6),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                                  decoration: BoxDecoration(
                                    color: role == 'PARENT' ? const Color(0xFFEFF6FF) : const Color(0xFFFEF3C7),
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: Text(
                                    role == 'PARENT' ? '학부모' : '교직원',
                                    style: TextStyle(
                                      fontSize: 9,
                                      color: role == 'PARENT' ? const Color(0xFF2563EB) : const Color(0xFFD97706),
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ),
                                if (dateStr.isNotEmpty) ...[
                                  const SizedBox(width: 6),
                                  Text(
                                    dateStr.length >= 16 ? dateStr.substring(5, 16).replaceAll('T', ' ') : dateStr,
                                    style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8)),
                                  ),
                                ],
                                const Spacer(),
                                if (commentId > 0 && isMyComment)
                                  InkWell(
                                    onTap: () => _deleteComment(commentId),
                                    child: const Padding(
                                      padding: EdgeInsets.all(2.0),
                                      child: Icon(Icons.close_rounded, size: 14, color: Color(0xFF94A3B8)),
                                    ),
                                  ),
                              ],
                            ),
                            const SizedBox(height: 6),
                            Text(content, style: const TextStyle(fontSize: 13, color: Color(0xFF1E293B), height: 1.35)),
                          ],
                        ),
                      );
                    }),
                ],
              ),
            ),
          ),
          // 댓글 입력창 (안드로이드 하단 버튼 영역에 가려지지 않게 안전 영역 안에 둔다)
          SafeArea(
            top: false,
            child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: const BoxDecoration(
              color: Colors.white,
              border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
            ),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _commentController,
                    onSubmitted: (_) => _addComment(),
                    decoration: const InputDecoration(
                      hintText: '댓글을 입력하세요...',
                      hintStyle: TextStyle(fontSize: 13, color: Color(0xFF94A3B8)),
                      border: InputBorder.none,
                      isDense: true,
                    ),
                  ),
                ),
                if (_isSubmittingComment)
                  const SizedBox(
                    width: 28,
                    height: 28,
                    child: Padding(
                      padding: EdgeInsets.all(4.0),
                      child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF2563EB)),
                    ),
                  )
                else
                  IconButton(
                    onPressed: _addComment,
                    icon: const Icon(Icons.send_rounded, color: Color(0xFF2563EB)),
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

/// 글을 열지 않고 바로 댓글을 쓰는 하단 입력창
class _QuickCommentSheet extends StatefulWidget {
  final int postId;
  final String postTitle;

  const _QuickCommentSheet({required this.postId, required this.postTitle});

  @override
  State<_QuickCommentSheet> createState() => _QuickCommentSheetState();
}

class _QuickCommentSheetState extends State<_QuickCommentSheet> {
  final TextEditingController _controller = TextEditingController();
  bool _sending = false;
  String? _error;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final text = _controller.text.trim();
    if (text.isEmpty || _sending) return;
    final user = ApiService().currentUser;
    final authorName = (user?.name != null && user!.name.isNotEmpty) ? user.name : '학부모';
    setState(() {
      _sending = true;
      _error = null;
    });
    final res = await ApiService().addPostComment(
      widget.postId,
      content: text,
      authorName: authorName,
      authorRole: 'PARENT',
    );
    if (!mounted) return;
    if (res['success'] == true) {
      final data = res['data'];
      Navigator.pop(context, data is Map ? Map<String, dynamic>.from(data) : {'authorName': authorName, 'authorRole': 'PARENT', 'content': text});
    } else {
      setState(() {
        _sending = false;
        _error = res['message']?.toString() ?? '댓글 등록에 실패했습니다.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    // 키보드가 올라오면 입력창도 그 위로 올라온다 (useSafeArea 로 하단 시스템 버튼 영역도 피한다)
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 8, 10),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                widget.postTitle.isEmpty ? '댓글 쓰기' : widget.postTitle,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF475569)),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _controller,
                      autofocus: true,
                      minLines: 1,
                      maxLines: 4,
                      maxLength: 1000,
                      textInputAction: TextInputAction.newline,
                      decoration: InputDecoration(
                        hintText: '댓글을 입력하세요...',
                        hintStyle: const TextStyle(fontSize: 14, color: Color(0xFF94A3B8)),
                        counterText: '',
                        isDense: true,
                        filled: true,
                        fillColor: const Color(0xFFF1F5F9),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(20), borderSide: BorderSide.none),
                      ),
                    ),
                  ),
                  IconButton(
                    onPressed: _sending ? null : _send,
                    icon: _sending
                        ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Icon(Icons.send_rounded, color: Color(0xFF2563EB)),
                  ),
                ],
              ),
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text(_error!, style: const TextStyle(fontSize: 12, color: Color(0xFFEF4444))),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
