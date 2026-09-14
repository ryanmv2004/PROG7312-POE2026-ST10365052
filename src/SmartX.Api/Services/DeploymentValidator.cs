using SmartX.Api.Models;

namespace SmartX.Api.Services;

public sealed class DeploymentValidator(SensorRepository sensors)
{
    public DeploymentValidation Validate(DeploymentNode? root)
    {
        List<DeploymentIssue> errors = [];
        List<DeploymentPlacement> placements = [];
        var registered = sensors.All().Select(s => s.Id).ToHashSet();
        HashSet<string> nodeIds = new(StringComparer.OrdinalIgnoreCase);
        HashSet<Guid> placedSensors = [];
        HashSet<DeploymentNode> ancestors = new(ReferenceEqualityComparer.Instance);
        int count = 0;

        void Visit(DeploymentNode? node, DeploymentNodeKind? parent, string parentPath,
            bool ancestorsEnabled, int depth)
        {
            if (count >= 100) { if (errors.All(e => e.Message != "Maximum 100 deployment nodes."))
                errors.Add(new(parentPath, "Maximum 100 deployment nodes.")); return; }
            if (node is null) { errors.Add(new(parentPath, "A deployment node cannot be null.")); return; }
            if (depth > 8) { errors.Add(new(parentPath, "Maximum deployment depth is 8.")); return; }
            if (!ancestors.Add(node)) { errors.Add(new(parentPath, "A deployment cycle was detected.")); return; }
            count++;
            var path = string.IsNullOrEmpty(parentPath) ? node.Name ?? "(unnamed)" : $"{parentPath} > {node.Name}";
            if (string.IsNullOrWhiteSpace(node.Id) || node.Id.Length > 80 || !nodeIds.Add(node.Id.Trim()))
                errors.Add(new(path, "Node ID must be non-empty, unique and at most 80 characters."));
            if (string.IsNullOrWhiteSpace(node.Name) || node.Name.Length > 100)
                errors.Add(new(path, "Node name must contain 1 to 100 characters."));
            bool hierarchyValid = parent switch
            {
                null => node.Kind == DeploymentNodeKind.Facility,
                DeploymentNodeKind.Facility => node.Kind == DeploymentNodeKind.Zone,
                DeploymentNodeKind.Zone or DeploymentNodeKind.SubZone => node.Kind is DeploymentNodeKind.SubZone or DeploymentNodeKind.Device,
                _ => false
            };
            if (!hierarchyValid) errors.Add(new(path, "Invalid hierarchy: Facility > Zone > optional SubZone(s) > Device."));
            bool safelyEnabled = ancestorsEnabled && node.Enabled;
            if (!node.Enabled) errors.Add(new(path, "Node is disabled; enable it before saving a safe deployment."));
            var children = node.Children ?? [];
            if (node.Children is null) errors.Add(new(path, "Children must be an array; use [] for a leaf."));
            if (children.Length > 100) { errors.Add(new(path, "A node may have at most 100 direct children.")); }
            if (node.Kind == DeploymentNodeKind.Device)
            {
                if (children.Length != 0) errors.Add(new(path, "Device nodes cannot have children."));
                if (node.SensorId is not Guid id || !registered.Contains(id))
                    errors.Add(new(path, "Device must reference a registered sensor ID."));
                else if (!placedSensors.Add(id)) errors.Add(new(path, "This sensor is assigned more than once."));
                else
                {
                    if (!safelyEnabled) errors.Add(new(path, "Device is unsafe because it or an ancestor is disabled."));
                    placements.Add(new(id, path));
                }
            }
            else if (node.SensorId is not null) errors.Add(new(path, "Only device nodes may reference a sensor."));

            // Recursive descent carries the full path and inherited safety state.
            foreach (var child in children.Take(100)) Visit(child, node.Kind, path, safelyEnabled, depth + 1);
            ancestors.Remove(node); // Backtrack after visiting this subtree.
        }
        Visit(root, null, "", true, 1);
        if (placements.Count == 0) errors.Add(new("", "Include at least one registered device in the deployment."));
        return new(errors.Count == 0, count, errors, placements);
    }
}
