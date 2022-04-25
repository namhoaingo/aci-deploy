import { ContainerInstanceManagementClient, ContainerGroup, ResourceRequirements, Port } from "@azure/arm-containerinstance";
import { DefaultAzureCredential } from "@azure/identity";
// For client-side applications running in the browser, use InteractiveBrowserCredential instead of DefaultAzureCredential. See https://aka.ms/azsdk/js/identity/examples for more details.
import * as core from '@actions/core';

// Set these as env variable
//AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_CLIENT_SECRET.
const subscriptionId = core.getInput("SubcriptionId");
const client = new ContainerInstanceManagementClient(new DefaultAzureCredential(), subscriptionId);
import { TaskParameters } from "./taskparameters";
var prefix = !!process.env.AZURE_HTTP_USER_AGENT ? `${process.env.AZURE_HTTP_USER_AGENT}` : "";

async function main() {
    try {
        // deployment 
        var taskParams = TaskParameters.getTaskParams();
        core.debug("Deployment Step Started");
        let containerGroupInstance: ContainerGroup = {
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
            "ipAddress": {
                "ports": getPorts(taskParams),
                "type": taskParams.ipAddress,
                "dnsNameLabel": taskParams.dnsNameLabel
            },
            "diagnostics": taskParams.diagnostics,
            "volumes": taskParams.volumes,
            "osType": taskParams.osType,
            "restartPolicy": taskParams.restartPolicy,
            "type": "Microsoft.ContainerInstance/containerGroups",
            "name": taskParams.containerName,
            "subnetIds": [
                {
                    "id": taskParams.vnetContainerGroupSubnetId,
                    "name": taskParams.vnetContainerGroupSubnetName
                }
            ]
        }
        let containerDeploymentResult = await client.containerGroups.beginCreateOrUpdateAndWait(taskParams.resourceGroup, taskParams.containerName, containerGroupInstance);
        if (containerDeploymentResult.provisioningState == "Succeeded") {
            console.log("Deployment Succeeded.");
            let appUrlWithoutPort = containerDeploymentResult.ipAddress?.fqdn;
            let port = taskParams.ports[0].port;
            let appUrl = "http://" + appUrlWithoutPort + ":" + port.toString() + "/"
            core.setOutput("app-url", appUrl);
            console.log("Your App has been deployed at: " + appUrl);
        } else {
            core.debug("Deployment Result: " + containerDeploymentResult);
            throw Error("Container Deployment Failed" + containerDeploymentResult);
        }
    }
    catch (error) {
        core.debug("Deployment Failed with Error: " + error);
        core.setFailed("error");
    }
    finally {
        // Reset AZURE_HTTP_USER_AGENT
        core.exportVariable('AZURE_HTTP_USER_AGENT', prefix);
    }

    function getResources(taskParams: TaskParameters): ResourceRequirements {
        if (taskParams.gpuCount) {
            let resRequirements: ResourceRequirements = {
                "requests": {
                    "cpu": taskParams.cpu,
                    "memoryInGB": taskParams.memory,
                    "gpu": {
                        "count": taskParams.gpuCount,
                        "sku": taskParams.gpuSku
                    }
                }
            }
            return resRequirements;
        } else {
            let resRequirements: ResourceRequirements = {
                "requests": {
                    "cpu": taskParams.cpu,
                    "memoryInGB": taskParams.memory
                }
            }
            return resRequirements;
        }
    }

    function getPorts(taskParams: TaskParameters): Array<Port> {
        let ports = taskParams.ports;
        ports.forEach((port) => {
            port.protocol = taskParams.protocol;
        });
        return ports;
    }
}
main();