import 'package:json_annotation/json_annotation.dart';

part 'event_queue_model.g.dart';

enum EventType {
  location,
  appUsage,
  notification,
  deviceStatus,
  callLog,
  contact,
  galleryItem,
  browsingHistory,
  geofenceAlert,
}

enum EventStatus { pending, inProgress, failed, deadLetter, completed }

@JsonSerializable()
class EventQueueModel {
  const EventQueueModel({
    required this.id,
    required this.eventType,
    required this.payload,
    required this.createdAt,
    this.status = EventStatus.pending,
    this.retryCount = 0,
    this.lastAttemptAt,
    this.errorMessage,
  });

  final String id;
  final EventType eventType;

  /// The full serialised data object for this event.
  final Map<String, dynamic> payload;
  final DateTime createdAt;
  final EventStatus status;
  final int retryCount;
  final DateTime? lastAttemptAt;
  final String? errorMessage;

  factory EventQueueModel.fromJson(Map<String, dynamic> json) =>
      _$EventQueueModelFromJson(json);

  Map<String, dynamic> toJson() => _$EventQueueModelToJson(this);

  EventQueueModel copyWith({
    EventStatus? status,
    int? retryCount,
    DateTime? lastAttemptAt,
    String? errorMessage,
  }) =>
      EventQueueModel(
        id: id,
        eventType: eventType,
        payload: payload,
        createdAt: createdAt,
        status: status ?? this.status,
        retryCount: retryCount ?? this.retryCount,
        lastAttemptAt: lastAttemptAt ?? this.lastAttemptAt,
        errorMessage: errorMessage ?? this.errorMessage,
      );
}
