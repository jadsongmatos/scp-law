import socket


def force_ipv4() -> None:
    original = socket.getaddrinfo

    def _ipv4_only(*args, **kwargs):
        host = args[0] if len(args) >= 1 else kwargs.get('host')
        port = args[1] if len(args) >= 2 else kwargs.get('port')
        type_ = args[3] if len(args) >= 4 else kwargs.get('type', 0)
        proto = args[4] if len(args) >= 5 else kwargs.get('proto', 0)
        flags = args[5] if len(args) >= 6 else kwargs.get('flags', 0)
        return original(host, port, socket.AF_INET, type_, proto, flags)

    socket.getaddrinfo = _ipv4_only
