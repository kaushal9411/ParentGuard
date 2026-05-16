sealed class AppException implements Exception {
  const AppException(this.message);

  final String message;

  @override
  String toString() => '$runtimeType: $message';
}

class PermissionDeniedException extends AppException {
  const PermissionDeniedException(super.message);
}

class PlatformChannelException extends AppException {
  const PlatformChannelException(super.message);
}

class DatabaseException extends AppException {
  const DatabaseException(super.message);
}

class SyncException extends AppException {
  const SyncException(super.message);
}

class LocationException extends AppException {
  const LocationException(super.message);
}

class DeviceInfoException extends AppException {
  const DeviceInfoException(super.message);
}
