"""This module identifies differentially expressed genes. It delegates to the
appropriate method depending on user options and defaults to the
characteristic direction.

__authors__ = "Gregory Gundersen, Axel Feldmann, Kevin Hu"
__credits__ = "Ma'ayan Lab, Icahn School of Medicine at Mount Sinai"
__contact__ = "avi.maayan@mssm.edu"
"""


from scipy import stats

import chdir
from server.log import pprint


def analyze(A, B, genes, config, filename=''):
	"""Identifies differentially expressed genes, delegating to the correct
	helper function based on client or default configuration.
	"""

	# Default is 500.
	HALF_CUTOFF = config.cutoff / 2 if config.cutoff else None

	# Default to the characteristic direction.
	if config.method == 'ttest':
		gene_pvalues = ttest(A, B, genes)
	else:
		pprint('Calculating the characteristic direction.')
		genes, pvalues = chdir.chdir(A, B, genes.tolist())

	# Sort pvalues and genes by the absolute pvalues in descending order.
	# Notice we do *not* return the absolute pvalue; we return the unmodified
	# pvalue!
	grouped = zip([abs(pv) for pv in pvalues], genes, pvalues)
	grouped = sorted(grouped, key=lambda item: item[0], reverse=True)

	# Apply cutoff. In Python, you can index with None; for example:
	# >>> a = range(10)
	# >>> a[None:None]
	# [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
	result = grouped[:HALF_CUTOFF] + grouped[-HALF_CUTOFF:] if HALF_CUTOFF else grouped
	return [(item[1], item[2]) for item in result]


def ttest(A, B, genes):
	"""Performs a standard T-test.
	"""

	pvalues = []
	for i in range(len(A)):
		ttest_results = stats.ttest_ind(A[i], B[i])
		# TODO: Ask Andrew if I should use `all()` or `any()`.
		signed_pvalue = ttest_results[1] if (ttest_results[0] > 0).all() else (ttest_results[1] * -1)
		pvalues.append((genes[i], signed_pvalue))

	# TODO: This should also handle a cutoff.
	return pvalues