import 'package:json_annotation/json_annotation.dart';

part 'app_usage_model.g.dart';

@JsonSerializable()
class AppUsageModel {
  const AppUsageModel({
    required this.id,
    required this.deviceId,
    required this.packageName,
    required this.appName,
    required this.usageDurationMs,
    required this.lastUsed,
    required this.capturedAt,
    this.synced = false,
    this.category,
  });

  final String id;
  final String deviceId;
  final String packageName;
  final String appName;

  /// Total foreground time in milliseconds for the queried interval.
  final int usageDurationMs;
  final DateTime lastUsed;
  final DateTime capturedAt;
  final bool synced;
  final String? category;

  int get usageDurationMinutes => usageDurationMs ~/ 60000;

  factory AppUsageModel.fromJson(Map<String, dynamic> json) =>
      _$AppUsageModelFromJson(json);

  Map<String, dynamic> toJson() => _$AppUsageModelToJson(this);
}
