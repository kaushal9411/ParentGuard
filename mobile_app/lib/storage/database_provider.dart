import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'app_database.dart';

/// Application-wide singleton database. keepAlive ensures it persists
/// for the full app lifetime and is never garbage-collected.
final appDatabaseProvider = Provider<AppDatabase>((ref) {
  final db = AppDatabase();
  ref.onDispose(db.close);
  return db;
}, name: 'appDatabase');
