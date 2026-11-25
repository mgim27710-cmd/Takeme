class StudentModel {
  final int id;
  final String name;
  final String? realName;
  final String address;
  final String? boardingLocation;
  final String? dropoffLocation;
  final double? latitude;
  final double? longitude;
  final String allergies;
  final String? gender;
  /// 주보호자 성함·관계 (원아 정보의 보호자1)
  final String parentName;
  final String parentRelation;
  /// 비상연락망 = 원아 정보의 보호자2. 주보호자가 연락이 안 될 때 연락할 사람
  final String emergencyContactName;
  final String emergencyContactRelation;
  final String emergencyContactPhone;
  final bool boarded;
  final bool absent;
  /// 이번 운행에서 하차함
  final bool dropped;
  final String expectedTime;
  final String? actualBoardTime;
  final String? teacherMemo;
  final String? parentMessage;
  final int runNumber;
  final bool isOverride;
  final String? className;
  final String? academyName;
  final String? vehicleName;
  final String? approvalStatus;

  StudentModel({
    required this.id,
    required this.name,
    this.realName,
    required this.address,
    this.boardingLocation,
    this.dropoffLocation,
    this.latitude,
    this.longitude,
    this.allergies = '',
    this.gender,
    this.parentName = '',
    this.parentRelation = '',
    this.emergencyContactName = '',
    this.emergencyContactRelation = '',
    this.emergencyContactPhone = '',
    this.boarded = false,
    this.absent = false,
    this.dropped = false,
    this.expectedTime = '15:30',
    this.actualBoardTime,
    this.teacherMemo,
    this.parentMessage,
    this.runNumber = 1,
    this.isOverride = false,
    this.className,
    this.academyName,
    this.vehicleName,
    this.approvalStatus,
  });

  factory StudentModel.fromJson(Map<String, dynamic> json) {
    double? parseCoord(dynamic val) {
      if (val == null) return null;
      if (val is num) return val.toDouble();
      return double.tryParse(val.toString());
    }

    return StudentModel(
      id: json['id'] is int ? json['id'] : (int.tryParse(json['id']?.toString() ?? '0') ?? 0),
      name: json['name'] ?? '',
      realName: json['realName'],
      address: json['address'] ?? '',
      boardingLocation: json['boardingLocation'],
      dropoffLocation: json['dropoffLocation'],
      latitude: parseCoord(json['latitude'] ?? json['lat']),
      longitude: parseCoord(json['longitude'] ?? json['lng']),
      allergies: json['allergies'] ?? '',
      parentName: json['parentName']?.toString() ?? '',
      parentRelation: json['parentRelation']?.toString() ?? '',
      emergencyContactName: json['emergencyContactName']?.toString() ?? '',
      emergencyContactRelation: json['emergencyContactRelation']?.toString() ?? '',
      emergencyContactPhone: json['emergencyContactPhone']?.toString() ?? '',
      gender: (json['gender']?.toString().trim().isEmpty ?? true) ? null : json['gender'].toString().trim(),
      boarded: json['boarded'] == true || json['boardStatus'] == 'BOARDED',
      absent: json['absent'] == true || json['boardStatus'] == 'ABSENT',
      dropped: json['dropped'] == true || json['boardStatus'] == 'DROPPED',
      expectedTime: json['expectedTime'] ?? '15:30',
      actualBoardTime: json['actualBoardTime']?.toString(),
      teacherMemo: json['teacherMemo'],
      parentMessage: json['parentMessage'],
      runNumber: json['runNumber'] is int ? json['runNumber'] : (int.tryParse(json['runNumber']?.toString() ?? '1') ?? 1),
      isOverride: json['isOverride'] == true,
      className: json['className'] ?? json['class'] ?? json['assignedClass'],
      academyName: json['academyName'],
      vehicleName: json['vehicleName'] ?? json['vehicle'] ?? json['assignedVehicleName'],
      approvalStatus: json['approvalStatus'],
    );
  }
}
