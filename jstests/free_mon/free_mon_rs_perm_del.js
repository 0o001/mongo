// Validate that if the endpoint says permanently delete that the state
// document is deleted and replicated properly
import {
    FAULT_PERMANENTLY_DELETE_AFTER_3,
    FreeMonWebServer,
    WaitForFreeMonServerStatusState,
    WaitForRegistration,
} from "jstests/free_mon/libs/free_mon.js";

let mock_web = new FreeMonWebServer(FAULT_PERMANENTLY_DELETE_AFTER_3, true);

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

WaitForRegistration(rst.getPrimary());
WaitForRegistration(rst.getSecondary());

mock_web.enableFaults();
mock_web.waitFaults(1);

sleep(20 * 1000);

// Make sure we are back to the initial state.
WaitForFreeMonServerStatusState(rst.getPrimary(), 'undecided');
WaitForFreeMonServerStatusState(rst.getSecondary(), 'undecided');

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
