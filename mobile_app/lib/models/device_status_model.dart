import 'package:json_annotation/json_annotation.dart';

part 'device_status_model.g.dart';

@JsonSerializable()
class DeviceStatusModel {
  const DeviceStatusModel({
    required this.id,
    required this.deviceId,
    required this.batteryLevel,
    required this.isCharging,
    required this.networkType,
    required this.isConnected,
    required this.capturedAt,
    this.synced = false,
    this.wifiSsid,
    this.signalStrength,
  });

  final String id;
  final String deviceId;

  /// Battery percentage [0, 100].
  final int batteryLevel;
  final bool isCharging;

  /// "wifi" | "mobile" | "ethernet" | "none"
  final String networkType;
  final bool isConnected;
  final DateTime capturedAt;
  final bool synced;
  final String? wifiSsid;

  /// Signal strength in dBm (negative integer). Null when not on wifi.
  final int? signalStrength;

  factory DeviceStatusModel.fromJson(Map<String, dynamic> json) =>
      _$DeviceStatusModelFromJson(json);

  Map<String, dynamic> toJson() => _$DeviceStatusModelToJson(this);
}
