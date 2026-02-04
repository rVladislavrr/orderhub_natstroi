import logging
import sys
from logging import Formatter, StreamHandler

from src.config import settings


class ColorFormatter(Formatter):

    grey = "\x1b[38;20m"
    yellow = "\x1b[33;20m"
    red = "\x1b[31;20m"
    bold_red = "\x1b[31;1m"
    reset = "\x1b[0m"
    msg = "%(levelname)s:     %(asctime)s - %(name)s - %(message)s"

    FORMATS = {
        logging.DEBUG: grey + msg + reset,
        logging.INFO: grey + msg + reset,
        logging.WARNING: yellow + msg + reset,
        logging.ERROR: red + msg + reset,
        logging.CRITICAL: bold_red + msg + reset
    }

    def format(self, record):
        log_fmt = self.FORMATS.get(record.levelno)
        formatter = Formatter(log_fmt)
        return formatter.format(record)


def setup_logging(name: str, log_level: str = settings.LOG_LEVEL):
    logger = logging.getLogger(name)
    logger.setLevel(log_level)

    console_handler = StreamHandler(sys.stdout)
    console_handler.setFormatter(ColorFormatter())

    logger.addHandler(console_handler)

    return logger
