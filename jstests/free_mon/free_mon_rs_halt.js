// Validate that if the endpoint returns halt = true that free monitoring halts
import {
    FAULT_HALT_METRICS_5,
    FreeMonWebServer,
    WaitForFreeMonServerStatusState,
    WaitForRegistration,
} from "jstests/free_mon/libs/free_mon.js";

let mock_web = new FreeMonWebServer(FAULT_HALT_METRICS_5, true);

mock_web.start();

let options = {
    setParameter: "cloudFreeMonitoringEndpointURL=" + mock_web.getURL(),
    enableFreeMonitoring: "on",
    verbose: 1,
};

const rst = new ReplSetTest({nodes: 2, nodeOptions: options});
rst.startSet();
rst.initiate();
rst.awaitReplication();

WaitForRegistration(rst.getPrimary());

mock_web.waitRegisters(2);

WaitForFreeMonServerStatusState(rst.getPrimary(), 'enabled');
WaitForFreeMonServerStatusState(rst.getSecondary(), 'enabled');

mock_web.enableFaults();
mock_web.waitFaults(1);

const qs1 = mock_web.queryStats();

sleep(20 * 1000);

const qs2 = mock_web.queryStats();

// Verify free monitoring stops but tolerate one additional collection
assert.gte(qs1.metrics + 1, qs2.metrics);
assert.eq(qs1.registers, qs2.registers);

// Halt causes us to disable free monitoring, not return it to initial state.
WaitForFreeMonServerStatusState(rst.getPrimary(), 'disabled');
WaitForFreeMonServerStatusState(rst.getSecondary(), 'disabled');

// Disable the fault so we can re-enable again
mock_web.disableFaults();

// Enable it again to be sure we can resume
assert.commandWorked(rst.getPrimary().adminCommand({setFreeMonitoring: 1, action: "enable"}));
WaitForRegistration(rst.getPrimary());
WaitForRegistration(rst.getSecondary());

sleep(20 * 1000);

WaitForFreeMonServerStatusState(rst.getPrimary(), 'enabled');
WaitForFreeMonServerStatusState(rst.getSecondary(), 'enabled');

rst.stopSet();

mock_web.stop();
