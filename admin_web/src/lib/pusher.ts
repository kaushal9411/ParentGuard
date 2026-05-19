import Pusher from 'pusher-js';

let _pusher: Pusher | null = null;

export function getPusher(): Pusher {
  if (!_pusher) {
    _pusher = new Pusher(
      process.env.NEXT_PUBLIC_SOKETI_APP_KEY ?? 'parentguard-key',
      {
        wsHost:             process.env.NEXT_PUBLIC_SOKETI_HOST ?? 'localhost',
        wsPort:             Number(process.env.NEXT_PUBLIC_SOKETI_PORT ?? 6001),
        wssPort:            Number(process.env.NEXT_PUBLIC_SOKETI_PORT ?? 6001),
        forceTLS:           false,
        disableStats:       true,
        enabledTransports:  ['ws'],
        cluster:            'mt1', // required by pusher-js but ignored by Soketi
      },
    );
  }
  return _pusher;
}

export function disconnectPusher(): void {
  _pusher?.disconnect();
  _pusher = null;
}
