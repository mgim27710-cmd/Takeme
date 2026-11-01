class UserModel {
  final int? id;
  final String email;
  final String name;
  final String role;
  final String? token;
  final int? academyId;
  final String? academyName;
  final String? assignedClass;

  UserModel({
    this.id,
    required this.email,
    required this.name,
    required this.role,
    this.token,
    this.academyId,
    this.academyName,
    this.assignedClass,
  });

  factory UserModel.fromJson(Map<String, dynamic> json, {String? token}) {
    return UserModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id']?.toString() ?? ''),
      email: json['email'] ?? '',
      name: json['name'] ?? '',
      role: json['role'] ?? 'STUDENT',
      token: token ?? json['token'],
      academyId: json['academyId'] is int ? json['academyId'] : int.tryParse(json['academyId']?.toString() ?? ''),
      academyName: json['academyName'] ?? json['academy']?['name'],
      assignedClass: json['assignedClass'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'name': name,
      'role': role,
      'token': token,
      'academyId': academyId,
      'academyName': academyName,
      'assignedClass': assignedClass,
    };
  }
}

class VehicleModel {
  final String id;
  final String plateNumber;
  final String model;
  final int capacity;
  final String? routeId;
  final String? routeName;

  VehicleModel({
    required this.id,
    required this.plateNumber,
    required this.model,
    required this.capacity,
    this.routeId,
    this.routeName,
  });

  factory VehicleModel.fromJson(Map<String, dynamic> json) {
    return VehicleModel(
      id: json['id']?.toString() ?? '',
      plateNumber: json['plateNumber'] ?? json['licensePlate'] ?? '',
      model: json['model'] ?? json['vehicleName'] ?? '',
      capacity: json['capacity'] ?? 15,
      routeId: json['routeId']?.toString() ?? json['route']?['id']?.toString(),
      routeName: json['routeName'] ?? json['route']?['name'],
    );
  }
}
