"""
Tests for the CK3 Language Server
"""

from pychivalry.server import CK3LanguageServer


def test_server_creation():
    """Test that the server can be created successfully"""
    server = CK3LanguageServer("test-server", "v0.1.0")
    assert server is not None
    assert server.name == "test-server"


def test_server_import():
    """Test that the server module can be imported"""
    from pychivalry import server

    assert hasattr(server, "CK3LanguageServer")
    assert hasattr(server, "main")


def test_package_version():
    """Test that the package version is defined"""
    import pychivalry

    assert hasattr(pychivalry, "__version__")
    assert pychivalry.__version__ == "0.1.0"
