"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const arm_containerinstance_1 = require("@azure/arm-containerinstance");
const identity_1 = require("@azure/identity");
// For client-side applications running in the browser, use InteractiveBrowserCredential instead of DefaultAzureCredential. See https://aka.ms/azsdk/js/identity/examples for more details.
const core = __importStar(require("@actions/core"));
// Set these as env variable
//AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_CLIENT_SECRET.
const subscriptionId = core.getInput("subcriptionid");
const client = new arm_containerinstance_1.ContainerInstanceManagementClient(new identity_1.DefaultAzureCredential(), subscriptionId);
const taskparameters_1 = require("./taskparameters");
var prefix = !!process.env.AZURE_HTTP_USER_AGENT ? `${process.env.AZURE_HTTP_USER_AGENT}` : "";
function main() {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // deployment 
            var taskParams = taskparameters_1.TaskParameters.getTaskParams();
            core.debug("Deployment Step Started");
            let containerGroupInstance = {
                "location": taskParams.location,
                "containers": [
                    {
                        "name": taskParams.containerName,
                        "command": taskParams.commandLine,
                        "environmentVariables": taskParams.environmentVariables,
                        "image": taskParams.image,
                        "ports": taskParams.ports,
                        "resources": getResources(taskParams),
                        "volumeMounts": taskParams.volumeMounts
                    }
                ],
                "imageRegistryCredentials": taskParams.registryUsername ? [{ "server": taskParams.registryLoginServer, "username": taskParams.registryUsername, "password": taskParams.registryPassword }] : [],
                // "ipAddress": {
                //     "ports": getPorts(taskParams),
                //     "type": taskParams.ipAddress,
                //     "dnsNameLabel": taskParams.dnsNameLabel
                // },
                "diagnostics": taskParams.diagnostics,
                "volumes": taskParams.volumes,
                "osType": taskParams.osType,
                "restartPolicy": taskParams.restartPolicy,
                "type": "Microsoft.ContainerInstance/containerGroups",
                "name": taskParams.containerName,
                "subnetIds": [
                    {
                        "id": taskParams.vnetcontainergroupsubnetid,
                        "name": taskParams.vnetcontainergroupsubnetname
                    }
                ]
            };
            let containerDeploymentResult = yield client.containerGroups.beginCreateOrUpdateAndWait(taskParams.resourceGroup, taskParams.containerName, containerGroupInstance);
            if (containerDeploymentResult.provisioningState == "Succeeded") {
                console.log("Deployment Succeeded.");
                let appUrlWithoutPort = (_a = containerDeploymentResult.ipAddress) === null || _a === void 0 ? void 0 : _a.fqdn;
                let port = taskParams.ports[0].port;
                let appUrl = "http://" + appUrlWithoutPort + ":" + port.toString() + "/";
                core.setOutput("app-url", appUrl);
                console.log("Your App has been deployed at: " + appUrl);
            }
            else {
                core.debug("Deployment Result: " + containerDeploymentResult);
                throw Error("Container Deployment Failed" + containerDeploymentResult);
            }
        }
        catch (error) {
            const castError = error;
            core.debug("Deployment Failed with Error: " + error);
            core.setFailed(castError);
        }
        finally {
            // Reset AZURE_HTTP_USER_AGENT
            core.exportVariable('AZURE_HTTP_USER_AGENT', prefix);
        }
        function getResources(taskParams) {
            if (taskParams.gpuCount) {
                let resRequirements = {
                    "requests": {
                        "cpu": taskParams.cpu,
                        "memoryInGB": taskParams.memory,
                        "gpu": {
                            "count": taskParams.gpuCount,
                            "sku": taskParams.gpuSku
                        }
                    }
                };
                return resRequirements;
            }
            else {
                let resRequirements = {
                    "requests": {
                        "cpu": taskParams.cpu,
                        "memoryInGB": taskParams.memory
                    }
                };
                return resRequirements;
            }
        }
        function getPorts(taskParams) {
            let ports = taskParams.ports;
            ports.forEach((port) => {
                port.protocol = taskParams.protocol;
            });
            return ports;
        }
    });
}
main();
