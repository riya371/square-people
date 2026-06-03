const { Employee } = require('../association');

// Generate the next unique employee_code for a company in EMP-0001 style.
// Counts existing employees with a code and bumps the sequence; retries on collision.
async function nextEmployeeCode(companyId, options = {}) {
  const transaction = options.transaction;
  const count = await Employee.count({
    where: { company_id: companyId },
    transaction,
  });
  let seq = count + 1;
  // Guard against gaps/collisions: probe until a free code is found.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const code = `EMP-${String(seq).padStart(4, '0')}`;
    const existing = await Employee.findOne({
      where: { company_id: companyId, employee_code: code },
      transaction,
    });
    if (!existing) return code;
    seq += 1;
  }
}

module.exports = { nextEmployeeCode };
