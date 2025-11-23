import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface MonthlyData {
  month: string;
  amount: number;
  budget: number;
}

interface MonthlyExpenseChartProps {
  data: MonthlyData[];
}

export function MonthlyExpenseChart({ data }: MonthlyExpenseChartProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
      notation: 'compact',
    }).format(value);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Spending Analysis</CardTitle>
        <CardDescription>Budget vs Actual spending by month</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="month" 
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis 
              tickFormatter={formatCurrency}
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <Tooltip 
              formatter={(value: number) => formatCurrency(value)}
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
            <Legend />
            <Bar 
              dataKey="budget" 
              fill="hsl(var(--primary))" 
              name="Monthly Budget"
              radius={[4, 4, 0, 0]}
            />
            <Bar 
              dataKey="amount" 
              fill="hsl(var(--accent))" 
              name="Actual Spent"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
