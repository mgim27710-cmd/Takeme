import 'package:flutter/material.dart';

class UserModel {
  final int? id;
  final String email;
  final String name;
  final String role;
  final String? token;
  final int? academyId;
  final String? assignedClass;
  final String? educationLevel; // 'KINDERGARTEN' | 'ELEMENTARY' | 'MIDDLE_HIGH' 또는 '유치원', '초등부', '중,고등부'

  UserModel({
    this.id,
    required this.email,
    required this.name,
    required this.role,
    this.token,
    this.academyId,
    this.assignedClass,
    this.educationLevel,
  });

  factory UserModel.fromJson(Map<String, dynamic> json, {String? token}) {
    return UserModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id']?.toString() ?? ''),
      email: json['email'] ?? '',
      name: json['name'] ?? '',
      role: json['role']?.toString() ?? '',
      token: token ?? json['token'],
      academyId: json['academyId'] is int ? json['academyId'] : int.tryParse(json['academyId']?.toString() ?? ''),
      assignedClass: json['assignedClass'],
      educationLevel: json['educationLevel']?.toString(),
    );
  }

  bool get isElementary {
    final lvl = (educationLevel ?? '').toUpperCase();
    return lvl == 'ELEMENTARY' || educationLevel == '초등부';
  }

  bool get isMiddleHigh {
    final lvl = (educationLevel ?? '').toUpperCase();
    return lvl == 'MIDDLE_HIGH' || educationLevel == '중,고등부' || educationLevel == '중등부';
  }

  bool get isKindergarten => !isElementary && !isMiddleHigh;

  /// 교육 단계별 용어 (원아 vs 학생)
  String get studentTerm => isKindergarten ? '원아' : '학생';
  String get institutionTerm => isKindergarten ? '유치원' : (isElementary ? '초등학교' : '중·고등학교');

  /// 교육 단계별 테마 대표 색상
  /// 유치원: Teal (기존 고유색 0xFF0D9488 유지)
  /// 초등부: Emerald (0xFF059669)
  /// 중·고등부: Indigo (0xFF4F46E5)
  Color get themePrimaryColor {
    if (isElementary) return const Color(0xFF059669);
    if (isMiddleHigh) return const Color(0xFF4F46E5);
    return const Color(0xFF0D9488);
  }

  static String getRoleKorean(String? role) {
    switch (role?.toUpperCase()) {
      case 'HOMEROOM_TEACHER':
        return '담임교사';
      case 'SHUTTLE_TEACHER':
        return '지도교사';
      case 'TEACHER':
        return '교사';
      case 'DRIVER':
        return '기사';
      case 'PARENT':
        return '학부모';
      case 'STUDENT':
        return '학생';
      case 'ACADEMY_ADMIN':
      case 'SUPER_ADMIN':
        return '기관 관리자';
      default:
        return '알 수 없음';
    }
  }

  String get roleKorean => getRoleKorean(role);

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'name': name,
      'role': role,
      'token': token,
      'academyId': academyId,
      'assignedClass': assignedClass,
      'educationLevel': educationLevel,
    };
  }
}
