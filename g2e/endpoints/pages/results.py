"""Results page for an extracted gene signature.
"""

from flask import Blueprint, request, render_template

from g2e.db import dataaccess
from g2e.config import Config
from g2e.core.targetapps.crowdsourcing import CROWDSOURCING_TAGS

results_page = Blueprint('results_page',
                         __name__,
                         url_prefix=Config.RESULTS_PAGE_URL)


@results_page.route('/<results_id>')
def results(results_id):
    """Single entry point for extracting a gene list from a SOFT file.
    """
    gene_signature = dataaccess.fetch_gene_signature(results_id)
    if gene_signature is None:
        return render_template('404.html')
    gene_signature = __process_extraction_for_view(gene_signature)

    use_crowdsourcing = False
    for tag in gene_signature.tags:
        if tag.name in CROWDSOURCING_TAGS:
            use_crowdsourcing = True

    if gene_signature.soft_file.samples:
        show_viz = True
    else:
        show_viz = False

    return render_template('results.html',
                           geneva_report_url=Config.GENEVA_REPORT_URL,
                           metadata_url=Config.GENEVA_METADATA_URL,
                           show_viz=show_viz,
                           pca_url=Config.BASE_PCA_URL,
                           gene_list_url=Config.GENE_LIST_URL,
                           cluster_url=Config.BASE_CLUSTER_URL,
                           use_simple_header=True,
                           permanent_link=request.url,
                           gene_signature=gene_signature,
                           use_crowdsourcing=use_crowdsourcing)


def __get_direction_as_string(direction):
    """Maps integer to human-readable string for gene list direction.
    """
    if direction == 1:
        return 'Up'
    elif direction == -1:
        return 'Down'
    else:
        return 'Combined'


def __process_extraction_for_view(gene_signature):
    """Cleans ORM object in preparation for HTML view.
    """
    for gene_list in gene_signature.gene_lists:
        gene_list.direction_as_string = __get_direction_as_string(gene_list.direction)

    if gene_signature.soft_file.normalize is None or gene_signature.soft_file.normalize is False:
        gene_signature.soft_file.normalize = False
    else:
        gene_signature.soft_file.normalize = True
    return gene_signature
