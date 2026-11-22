import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as io_client;
import '../config.dart';
import 'push_notification_service.dart';

class SocketService {
  static final SocketService _instance = SocketService._internal();
  factory SocketService() => _instance;
  SocketService._internal();

  io_client.Socket? _socket;
  String? _currentToken;
  bool get isConnected => _socket?.connected ?? false;

  /// 현재 사용자가 보고 있는 채팅방 ID (해당 방 메시지는 푸시 배너를 띄우지 않고 대화창에 실시간 표시)
  int? activeChatRoomId;

  // 이벤트 콜백 관리 리스트 (덮어쓰기로 인한 소멸 방지)
  final List<Function(Map<String, dynamic>)> _notificationCallbacks = [];
  final List<Function(Map<String, dynamic>)> _roomUpdatedCallbacks = [];
  final List<Function(Map<String, dynamic>)> _receiveMessageCallbacks = [];
  final List<Function(Map<String, dynamic>)> _messagesReadCallbacks = [];
  final List<Function(Map<String, dynamic>)> _locationUpdatedCallbacks = [];
  final List<Function(Map<String, dynamic>)> _routePathUpdatedCallbacks = [];

  void connect(String? token) {
    // 토큰이 변경되었거나 소켓이 없을 경우 재연결
    if (_socket != null && _socket!.connected && _currentToken == token) return;

    if (_socket != null) {
      try {
        _socket!.disconnect();
        _socket!.dispose();
      } catch (_) {}
      _socket = null;
    }
    _currentToken = token;

    final options = io_client.OptionBuilder()
        .setTransports(['websocket'])
        .enableAutoConnect()
        .enableReconnection();

    if (token != null && token.isNotEmpty) {
      options.setAuth({'token': token});
      options.setQuery({'token': token});
    }

    _socket = io_client.io(AppConfig.apiHost, options.build());

    _socket!.onConnect((_) {
      debugPrint('[Socket] Connected: ${_socket!.id}');
    });

    _socket!.onDisconnect((_) {
      debugPrint('[Socket] Disconnected');
    });

    // 1. notificationReceived (새 메시지 및 시스템 알림)
    _socket!.on('notificationReceived', (data) {
      debugPrint('[Socket] notificationReceived: $data');
      if (data is Map<String, dynamic> || data is Map) {
        final map = Map<String, dynamic>.from(data as Map);
        final title = map['title']?.toString() ?? 'TakeMe 알림';
        final message = (map['message'] ?? map['body'])?.toString().trim() ?? '';
        if (message.isEmpty) return;
        final roomId = int.tryParse(map['roomId']?.toString() ?? '');

        // 현재 보고 있는 채팅방이 아니면 상단 푸시 알림 배너 팝업 발생!
        if (roomId == null || roomId != activeChatRoomId) {
          PushNotificationService().showNotification(
            title: title,
            body: message,
            payload: jsonEncode(map),
          );
        }

        // 채팅방 보고 있는 중이라면 receiveMessage 콜백으로도 전달하여 실시간 표시
        if (roomId != null && roomId == activeChatRoomId) {
          for (final cb in List.from(_receiveMessageCallbacks)) {
            try {
              cb(map);
            } catch (e) {
              debugPrint('[Socket] receiveMessage callback error: $e');
            }
          }
        }

        // 등록된 알림 콜백들 실행 (뱃지 카운트 갱신 등)
        for (final cb in List.from(_notificationCallbacks)) {
          try {
            cb(map);
          } catch (e) {
            debugPrint('[Socket] notification callback error: $e');
          }
        }
      }
    });

    // 2. roomUpdated (대화방 목록 및 안 읽은 수 갱신)
    _socket!.on('roomUpdated', (data) {
      debugPrint('[Socket] roomUpdated: $data');
      final map = data is Map ? Map<String, dynamic>.from(data) : <String, dynamic>{};
      for (final cb in List.from(_roomUpdatedCallbacks)) {
        try {
          cb(map);
        } catch (e) {
          debugPrint('[Socket] roomUpdated callback error: $e');
        }
      }
    });

    // 3. receiveMessage (채팅방 내 실시간 메시지 수신)
    _socket!.on('receiveMessage', (data) {
      debugPrint('[Socket] receiveMessage: $data');
      if (data is Map<String, dynamic> || data is Map) {
        final map = Map<String, dynamic>.from(data as Map);
        for (final cb in List.from(_receiveMessageCallbacks)) {
          try {
            cb(map);
          } catch (e) {
            debugPrint('[Socket] receiveMessage callback error: $e');
          }
        }
      }
    });

    // 4. messagesRead (상대방 읽음 상태 실시간 반영)
    _socket!.on('messagesRead', (data) {
      if (data is Map<String, dynamic> || data is Map) {
        final map = Map<String, dynamic>.from(data as Map);
        for (final cb in List.from(_messagesReadCallbacks)) {
          try {
            cb(map);
          } catch (e) {
            debugPrint('[Socket] messagesRead callback error: $e');
          }
        }
      }
    });

    // 5. locationUpdated
    _socket!.on('locationUpdated', (data) {
      if (data is Map<String, dynamic> || data is Map) {
        final map = Map<String, dynamic>.from(data as Map);
        for (final cb in List.from(_locationUpdatedCallbacks)) {
          try {
            cb(map);
          } catch (_) {}
        }
      }
    });

    // 6. routePathUpdated
    _socket!.on('routePathUpdated', (data) {
      if (data is Map<String, dynamic> || data is Map) {
        final map = Map<String, dynamic>.from(data as Map);
        for (final cb in List.from(_routePathUpdatedCallbacks)) {
          try {
            cb(map);
          } catch (_) {}
        }
      }
    });

    _socket!.connect();
  }

  void joinVehicleRoom(int vehicleId) {
    _socket?.emit('joinVehicleRoom', {'vehicleId': vehicleId});
  }

  void leaveVehicleRoom(int vehicleId) {
    _socket?.emit('leaveVehicleRoom', {'vehicleId': vehicleId});
  }

  void sendLocationUpdate({
    required int vehicleId,
    required double lat,
    required double lng,
  }) {
    _socket?.emit('driverLocationUpdate', {
      'vehicleId': vehicleId,
      'lat': lat,
      'lng': lng,
    });
  }

  void sendOperationStatus({required int vehicleId, required bool isOperating}) {
    _socket?.emit('driverOperationStatus', {
      'vehicleId': vehicleId,
      'isOperating': isOperating,
    });
  }

  void joinChatRoom(int roomId) {
    activeChatRoomId = roomId;
    _socket?.emit('joinChatRoom', {'roomId': roomId});
  }

  void leaveChatRoom(int roomId) {
    if (activeChatRoomId == roomId) {
      activeChatRoomId = null;
    }
    _socket?.emit('leaveChatRoom', {'roomId': roomId});
  }

  void onNotificationReceived(Function(Map<String, dynamic> data) callback) {
    _notificationCallbacks.add(callback);
  }

  void onRoomUpdated(Function(Map<String, dynamic> data) callback, {String? key}) {
    _roomUpdatedCallbacks.add(callback);
  }

  void onReceiveMessage(Function(Map<String, dynamic> data) callback) {
    _receiveMessageCallbacks.add(callback);
  }

  void onMessagesRead(Function(Map<String, dynamic> data) callback) {
    _messagesReadCallbacks.add(callback);
  }

  void onLocationUpdated(Function(Map<String, dynamic> data) callback) {
    _locationUpdatedCallbacks.add(callback);
  }

  void onRoutePathUpdated(Function(Map<String, dynamic> data) callback) {
    _routePathUpdatedCallbacks.add(callback);
  }

  void offChatEvents() {
    _receiveMessageCallbacks.clear();
    _messagesReadCallbacks.clear();
  }

  void disconnect() {
    activeChatRoomId = null;
    _notificationCallbacks.clear();
    _roomUpdatedCallbacks.clear();
    _receiveMessageCallbacks.clear();
    _messagesReadCallbacks.clear();
    _locationUpdatedCallbacks.clear();
    _routePathUpdatedCallbacks.clear();
    _socket?.disconnect();
    _socket = null;
    _currentToken = null;
  }
}
