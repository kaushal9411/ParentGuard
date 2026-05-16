import 'package:json_annotation/json_annotation.dart';

part 'location_model.g.dart';

@JsonSerializable()
class LocationModel {
  const LocationModel({
    required this.id,
    required this.deviceId,
    required this.latitude,
    required this.longitude,
    required this.accuracy,
    required this.altitude,
    required this.speed,
    required this.heading,
    required this.provider,
    required this.capturedAt,
    this.synced = false,
    this.address,
  });

  final String id;
  final String deviceId;
  final double latitude;
  final double longitude;

  /// Accuracy radius in metres.
  final double accuracy;
  final double altitude;

  /// Speed in m/s.
  final double speed;

  /// Bearing in degrees [0, 360).
  final double heading;
  final String provider;
  final DateTime capturedAt;
  final bool synced;
  final String? address;

  factory LocationModel.fromJson(Map<String, dynamic> json) =>
      _$LocationModelFromJson(json);

  Map<String, dynamic> toJson() => _$LocationModelToJson(this);

  LocationModel copyWith({bool? synced, String? address}) => LocationModel(
        id: id,
        deviceId: deviceId,
        latitude: latitude,
        longitude: longitude,
        accuracy: accuracy,
        altitude: altitude,
        speed: speed,
        heading: heading,
        provider: provider,
        capturedAt: capturedAt,
        synced: synced ?? this.synced,
        address: address ?? this.address,
      );
}
