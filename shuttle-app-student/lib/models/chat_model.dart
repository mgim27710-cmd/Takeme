class ChatMember {
  final int id;
  final int userId;
  final String name;
  final String email;
  final String role;
  final String? assignedClass;

  ChatMember({
    required this.id,
    required this.userId,
    required this.name,
    required this.email,
    required this.role,
    this.assignedClass,
  });

  factory ChatMember.fromJson(Map<String, dynamic> json) {
    final user = json['user'] as Map<String, dynamic>? ?? {};
    return ChatMember(
      id: json['id'] as int? ?? 0,
      userId: user['id'] as int? ?? 0,
      name: user['name'] as String? ?? '사용자',
      email: user['email'] as String? ?? '',
      role: user['role'] as String? ?? '',
      assignedClass: user['assignedClass'] as String?,
    );
  }
}

class ChatMessageModel {
  final int id;
  final int roomId;
  final String text;
  final String type;
  final DateTime createdAt;
  final int senderId;
  final String senderName;
  final String senderEmail;
  final String senderRole;
  final List<String> readBy;

  ChatMessageModel({
    required this.id,
    required this.roomId,
    required this.text,
    required this.type,
    required this.createdAt,
    required this.senderId,
    required this.senderName,
    required this.senderEmail,
    required this.senderRole,
    required this.readBy,
  });

  bool isMe(String? myEmail) {
    if (myEmail == null) return false;
    return senderEmail.toLowerCase() == myEmail.toLowerCase();
  }

  factory ChatMessageModel.fromJson(Map<String, dynamic> json) {
    final sender = json['sender'] as Map<String, dynamic>? ?? {};
    final rawDate = json['createdAt'] as String?;
    DateTime parsedDate = DateTime.now();
    if (rawDate != null) {
      try {
        parsedDate = DateTime.parse(rawDate).toLocal();
      } catch (_) {}
    }

    final rawReadBy = json['readBy'] as List<dynamic>? ?? [];
    final readByList = rawReadBy.map((e) => e.toString()).toList();

    return ChatMessageModel(
      id: json['id'] as int? ?? 0,
      roomId: json['roomId'] is int ? json['roomId'] : (json['room']?['id'] as int? ?? 0),
      text: json['text'] as String? ?? '',
      type: json['type'] as String? ?? 'TEXT',
      createdAt: parsedDate,
      senderId: sender['id'] as int? ?? 0,
      senderName: sender['name'] as String? ?? '알 수 없음',
      senderEmail: sender['email'] as String? ?? '',
      senderRole: sender['role'] as String? ?? '',
      readBy: readByList,
    );
  }
}

class ChatRoomModel {
  final int id;
  final String name;
  final String type;
  final List<ChatMember> members;
  final ChatMessageModel? latestMessage;
  final int unreadCount;
  final DateTime? updatedAt;

  ChatRoomModel({
    required this.id,
    required this.name,
    required this.type,
    required this.members,
    this.latestMessage,
    required this.unreadCount,
    this.updatedAt,
  });

  factory ChatRoomModel.fromJson(Map<String, dynamic> json) {
    final rawMembers = json['members'] as List<dynamic>? ?? [];
    final members = rawMembers
        .whereType<Map<String, dynamic>>()
        .map((m) => ChatMember.fromJson(m))
        .toList();

    ChatMessageModel? latest;
    if (json['latestMessage'] is Map<String, dynamic>) {
      latest = ChatMessageModel.fromJson(json['latestMessage'] as Map<String, dynamic>);
    }

    final rawUpdated = json['updatedAt'] as String? ?? json['createdAt'] as String?;
    DateTime? updated;
    if (rawUpdated != null) {
      try {
        updated = DateTime.parse(rawUpdated).toLocal();
      } catch (_) {}
    }

    return ChatRoomModel(
      id: json['id'] as int? ?? 0,
      name: json['name'] as String? ?? '대화방',
      type: json['type'] as String? ?? 'DIRECT',
      members: members,
      latestMessage: latest,
      unreadCount: json['unreadCount'] as int? ?? 0,
      updatedAt: updated,
    );
  }

  /// 상대방(내가 아닌 멤버) 찾기
  ChatMember? getOtherMember(String? myEmail) {
    if (myEmail == null) return members.isNotEmpty ? members.first : null;
    return members.firstWhere(
      (m) => m.email.toLowerCase() != myEmail.toLowerCase(),
      orElse: () => members.isNotEmpty ? members.first : ChatMember(id: 0, userId: 0, name: '상대방', email: '', role: ''),
    );
  }

  /// 상대방 호칭/표시 이름
  String getDisplayName(String? myEmail) {
    if (type == 'PAYMENT_SYSTEM') {
      return name;
    }
    final other = getOtherMember(myEmail);
    if (other != null && other.name.isNotEmpty) {
      if (other.role == 'HOMEROOM_TEACHER') {
        final className = other.assignedClass != null ? '${other.assignedClass} ' : '';
        return '$className${other.name} 선생님';
      } else if (other.role == 'ACADEMY_ADMIN') {
        return '${other.name} (유치원 본원)';
      } else if (other.role == 'DRIVER') {
        return '${other.name} 기사님';
      }
      return other.name;
    }
    return name;
  }
}

