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
  String _selectedCategory = 'ALL'; // 'ALL', 'NOTICE', 'ALBUM', 'COMMUNITY'
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

  List<Map<String, dynamic>> get _filteredPosts {
    return _posts.where((p) {
      final title = (p['title'] ?? '').toString();
      final authorRole = (p['authorRole'] ?? '').toString();

      final List<dynamic> images = p['images'] is List ? p['images'] : [];
      final hasImage = (p['imageUrl'] != null && p['imageUrl'].toString().isNotEmpty) || images.isNotEmpty;

      if (_selectedCategory == 'NOTICE') {
        return authorRole == 'ADMIN' || authorRole == 'ACADEMY_ADMIN' || title.contains('공지');
      } else if (_selectedCategory == 'ALBUM') {
        return hasImage;
      } else if (_selectedCategory == 'COMMUNITY') {
        return authorRole == 'PARENT' || !title.contains('공지');
      }
      return true;
    }).toList();
  }

  void _openDetail(Map<String, dynamic> post) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => BoardDetailScreen(post: post),
      ),
    ).then((_) => _loadPosts());
  }

  void _showCreatePostModal() {
    final titleCtrl = TextEditingController();
    final contentCtrl = TextEditingController();
    String category = '자유게시판';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setModalState) => Container(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(context).viewInsets.bottom + 20,
            top: 20,
            left: 20,
            right: 20,
          ),
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      '게시판 글쓰기',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close_rounded, color: Color(0xFF94A3B8)),
                      onPressed: () => Navigator.pop(ctx),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: ['자유게시판', '육아 나눔', '학부모 질문'].map((cat) {
                    final isSel = category == cat;
                    return Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: ChoiceChip(
                        label: Text(cat, style: TextStyle(color: isSel ? Colors.white : const Color(0xFF475569), fontSize: 12)),
                        selected: isSel,
                        selectedColor: const Color(0xFF2563EB),
                        backgroundColor: const Color(0xFFF1F5F9),
                        onSelected: (_) => setModalState(() => category = cat),
                      ),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: titleCtrl,
                  decoration: InputDecoration(
                    hintText: '제목을 입력해주세요',
                    filled: true,
                    fillColor: const Color(0xFFF8FAFC),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                    contentPadding: const EdgeInsets.all(12),
                  ),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: contentCtrl,
                  maxLines: 5,
                  decoration: InputDecoration(
                    hintText: '원아 생활, 육아 정보 나눔, 문의사항 등을 자유롭게 작성해주세요.',
                    filled: true,
                    fillColor: const Color(0xFFF8FAFC),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                    contentPadding: const EdgeInsets.all(12),
                  ),
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton(
                    onPressed: () async {
                      final title = titleCtrl.text.trim();
                      final content = contentCtrl.text.trim();
                      if (title.isEmpty || content.isEmpty) return;

                      final user = ApiService().currentUser;
                      final res = await ApiService().createBoardPost(
                        title: '[$category] $title',
                        content: content,
                        authorName: user?.name ?? '학부모님',
                        authorRole: 'PARENT',
                        academyId: user?.academyId,
                        visibility: 'ALL',
                      );

                      if (ctx.mounted) {
                        Navigator.pop(ctx);
                      }
                      if (mounted) {
                        if (res['success'] == true) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('게시글이 등록되었습니다.'), backgroundColor: Color(0xFF10B981)),
                          );
                          _loadPosts();
                        } else {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text(res['message'] ?? '게시글 등록 실패'), backgroundColor: Colors.red),
                          );
                        }
                      }
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF2563EB),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: const Text('게시글 등록하기', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15)),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
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
        title: const Row(
          children: [
            Icon(Icons.dashboard_outlined, color: Color(0xFF2563EB), size: 22),
            SizedBox(width: 8),
            Text(
              '원 게시판 & 소식',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: Color(0xFF0F172A)),
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
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showCreatePostModal,
        backgroundColor: const Color(0xFF2563EB),
        icon: const Icon(Icons.edit_note_rounded, color: Colors.white),
        label: const Text('글쓰기', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF2563EB)))
          : Column(
              children: [
                // 검색바 & 카테고리
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
                      const SizedBox(height: 10),
                      // 카테고리 칩
                      SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: Row(
                          children: [
                            _buildCatChip('ALL', '전체 (${_posts.length})'),
                            const SizedBox(width: 8),
                            _buildCatChip('NOTICE', '📢 공지사항'),
                            const SizedBox(width: 8),
                            _buildCatChip('ALBUM', '📸 원아 앨범'),
                            const SizedBox(width: 8),
                            _buildCatChip('COMMUNITY', '💬 학부모 소통'),
                          ],
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
                    child: _filteredPosts.isEmpty
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
                                    '우측 하단 [글쓰기]를 눌러 첫 게시글을 작성해보세요.',
                                    style: TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                                  ),
                                ],
                              ),
                            ),
                          )
                        : ListView.separated(
                            padding: const EdgeInsets.all(16),
                            itemCount: _filteredPosts.length,
                            separatorBuilder: (_, __) => const SizedBox(height: 12),
                            itemBuilder: (ctx, idx) => _buildPostCard(_filteredPosts[idx]),
                          ),
                  ),
                ),
              ],
            ),
    );
  }

  Widget _buildCatChip(String value, String label) {
    final isSelected = _selectedCategory == value;
    return GestureDetector(
      onTap: () => setState(() => _selectedCategory = value),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF2563EB) : const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: isSelected ? Colors.transparent : const Color(0xFFE2E8F0)),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
            color: isSelected ? Colors.white : const Color(0xFF475569),
          ),
        ),
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
    final thumbUrl = (singleImage != null && singleImage.isNotEmpty)
        ? singleImage
        : (images.isNotEmpty ? images.first.toString() : null);

    final isNotice = role == 'ADMIN' || role == 'ACADEMY_ADMIN' || title.contains('공지');

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

                // 하단 인터랙션 (좋아요, 댓글 수)
                Row(
                  children: [
                    const Icon(Icons.favorite_rounded, size: 15, color: Color(0xFFEF4444)),
                    const SizedBox(width: 4),
                    Text('$likeCount', style: const TextStyle(fontSize: 12, color: Color(0xFF64748B), fontWeight: FontWeight.bold)),
                    const SizedBox(width: 16),
                    const Icon(Icons.mode_comment_outlined, size: 15, color: Color(0xFF3B82F6)),
                    const SizedBox(width: 4),
                    Text('$commentCount', style: const TextStyle(fontSize: 12, color: Color(0xFF64748B), fontWeight: FontWeight.bold)),
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
    _likeCount = widget.post['likeCount'] as int? ?? 0;
    _comments = List.from(widget.post['comments'] as List? ?? []);
    final user = ApiService().currentUser;
    final likedUsers = widget.post['likedUserIds'] as List? ?? [];
    if (user != null && likedUsers.contains(user.id.toString())) {
      _isLiked = true;
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

    final postId = widget.post['id'] as int;
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
    if (user == null) return;

    setState(() => _isSubmittingComment = true);
    final postId = widget.post['id'] as int;
    final res = await ApiService().addPostComment(
      postId,
      content: text,
      authorName: user.name,
      authorRole: 'PARENT',
    );

    if (mounted) {
      setState(() => _isSubmittingComment = false);
      if (res['success'] == true) {
        _commentController.clear();
        setState(() {
          _comments.add({
            'authorName': user.name,
            'authorRole': 'PARENT',
            'content': text,
            'createdAt': DateTime.now().toIso8601String(),
          });
        });
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
                            child: Image.network(img, width: double.infinity, fit: BoxFit.cover),
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
                    ..._comments.map((c) => Container(
                          margin: const EdgeInsets.only(bottom: 10),
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF8FAFC),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Text(c['authorName']?.toString() ?? '익명', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Color(0xFF334155))),
                                  const SizedBox(width: 6),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                                    decoration: BoxDecoration(color: const Color(0xFFE2E8F0), borderRadius: BorderRadius.circular(4)),
                                    child: Text(c['authorRole'] == 'PARENT' ? '학부모' : '교직원', style: const TextStyle(fontSize: 9, color: Color(0xFF64748B), fontWeight: FontWeight.bold)),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 4),
                              Text(c['content']?.toString() ?? '', style: const TextStyle(fontSize: 13, color: Color(0xFF1E293B))),
                            ],
                          ),
                        )),
                ],
              ),
            ),
          ),
          // 댓글 입력창
          Container(
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
                    decoration: const InputDecoration(
                      hintText: '댓글을 입력하세요...',
                      hintStyle: TextStyle(fontSize: 13, color: Color(0xFF94A3B8)),
                      border: InputBorder.none,
                      isDense: true,
                    ),
                  ),
                ),
                IconButton(
                  onPressed: _addComment,
                  icon: const Icon(Icons.send_rounded, color: Color(0xFF2563EB)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

