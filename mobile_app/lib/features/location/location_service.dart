import 'package:drift/drift.dart';
// Hide geolocator's own PermissionDeniedException to avoid ambiguity with ours.
import 'package:geolocator/geolocator.dart' hide PermissionDeniedException;
import 'package:uuid/uuid.dart';
import '../../core/errors/app_exceptions.dart';
import '../../core/utils/logger.dart';
import '../../models/location_model.dart';
import '../../storage/app_database.dart';
import '../../storage/tables/location_entries.dart';

class LocationService {
  LocationService(this._db);

  final AppDatabase _db;
  final _uuid = const Uuid();

  /// Captures the current GPS fix and persists it to the local DB.
  Future<LocationModel?> captureAndStore(String deviceId) async {
    final ok = await _checkPermission();
    if (!ok) throw const PermissionDeniedException('Location permission denied');

    Position position;
    try {
      position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 20),
      );
    } catch (e) {
      appLogger.e('GPS fix failed', error: e);
      rethrow;
    }

    final model = LocationModel(
      id: _uuid.v4(),
      deviceId: deviceId,
      latitude: position.latitude,
      longitude: position.longitude,
      accuracy: position.accuracy,
      altitude: position.altitude,
      speed: position.speed,
      heading: position.heading,
      provider: 'fused',
      capturedAt: DateTime.now(),
    );

    await _db.locationDao.upsert(
      LocationEntriesCompanion.insert(
        id: model.id,
        deviceId: model.deviceId,
        latitude: model.latitude,
        longitude: model.longitude,
        accuracy: model.accuracy,
        altitude: model.altitude,
        speed: model.speed,
        heading: model.heading,
        provider: model.provider,
        capturedAt: model.capturedAt,
      ),
    );

    appLogger.d(
      'Location: ${model.latitude.toStringAsFixed(5)}, '
      '${model.longitude.toStringAsFixed(5)}  '
      'acc=${model.accuracy.toStringAsFixed(0)}m',
    );
    return model;
  }

  /// Continuous stream suitable for showing live position on a map.
  Stream<Position> liveStream() => Geolocator.getPositionStream(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          distanceFilter: 10,
        ),
      );

  /// Prunes location records older than [days] to control DB size.
  Future<int> pruneOldRecords(int days) {
    final cutoff = DateTime.now().subtract(Duration(days: days));
    return _db.locationDao.deleteOlderThan(cutoff);
  }

  Future<bool> _checkPermission() async {
    LocationPermission perm = await Geolocator.checkPermission();
    if (perm == LocationPermission.denied) {
      perm = await Geolocator.requestPermission();
    }
    return perm == LocationPermission.always ||
        perm == LocationPermission.whileInUse;
  }
}
