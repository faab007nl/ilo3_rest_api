#!/command/with-contenv bashio
# ==============================================================================
# Home Assistant Community Add-on
# Runs the custom code
# ==============================================================================

echo "cron_schedule: $(bashio::config 'cron_schedule')";

crontab -l > mycron
echo "* * * * 1-5 echo hello" >> mycron
crontab mycron
rm mycron