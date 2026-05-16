import 'package:json_annotation/json_annotation.dart';

part 'notification_model.g.dart';

@JsonSerializable()
class NotificationModel {
  const NotificationModel({
    required this.id,
    required this.deviceId,
    required this.packageName,
    required this.appName,
    required this.title,
    required this.body,
    required this.postedAt,
    this.synced = false,
    this.category,
    this.extras,
  });

  final String id;
  final String deviceId;
  final String packageName;
  final String appName;
  final String title;
  final String body;
  final DateTime postedAt;
  final bool synced;
  final String? category;

  /// Arbitrary key-value extras from the notification bundle.
  final Map<String, dynamic>? extras;

  factory NotificationModel.fromJson(Map<String, dynamic> json) =>
      _$NotificationModelFromJson(json);

  Map<String, dynamic> toJson() => _$NotificationModelToJson(this);
}
