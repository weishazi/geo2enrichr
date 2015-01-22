
var GseUi = function(templater, events) {

	var $gse_details;

	return {

		embed: function($hook) {
			var self = this;
			$hook.append(templater.get('btn', 'gse'));

			// Find the details table.
			$('table').each(function(i, el) {
				var $el = $(el);
				if ($el.attr('width') === '600' &&
					$el.attr('cellpadding') === '2' &&
					$el.attr('cellspacing') === '0')
				{
					$gse_details = $el;
					return false;
				}
			});

			if ($gse_details) {
				// Find the samples from the details table.
				$gse_details.find('tr').each(function(i, tr) {
					if ($(tr).find('td')
							 .first()
							 .text()
							 .toLowerCase()
							 .indexOf('samples') === 0)
					{
						$samples_table = $(tr);
						return false;
					}
				});
			}

			if ($samples_table) {
				$samples_table.find('tr').each(function(i, tr) {
					$(tr).append(templater.get('chkbxs', 'gse'));
				});

				$samples_table.find('table')
							  .first()
							  .find('tr')
							  .first()
							  .before(templater.get('thead', 'gse'));
			}

			events.fire('uiReady', {
				details: $gse_details,
				table: $samples_table
			});

			$('#g2e-link').click(function() {
				self.openModalBox();
			});
		},

		init: function() {
			// Go up two parents to find the table.
			var $hook = $('#geo2r').next();
			if ($hook) {
				this.embed($hook);
			}
		}
	};
};
