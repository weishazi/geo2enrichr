"""Serves home page and miscellaneous pages.
"""

from flask import Blueprint, render_template
import json

from g2e.config import Config
from g2e.db import dataaccess

menu_pages = Blueprint('base',
                       __name__,
                       url_prefix=Config.BASE_URL)


@menu_pages.route('/')
def index_page():
    stats = dataaccess.get_statistics()
    stats_json = json.dumps(stats)
    return render_template('index.html',
                           stats=stats,
                           stats_json=stats_json)


@menu_pages.route('/documentation')
def documentation_page():
    return render_template('documentation.html')


@menu_pages.route('/manual')
def manual_page():
    return render_template('manual.html')


@menu_pages.route('/pipeline')
def pipeline_page():
    return render_template('pipeline.html')


@menu_pages.route('/about')
def about_page():
    return render_template('about.html')
